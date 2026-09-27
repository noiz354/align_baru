"""Benchmark command: snapshot quality metrics per run and diff experiments.

README Roadmap item 1: *"Benchmark command ala `recursive-improve benchmark`:
snapshot metrik kualitas per run, diff antar branch eksperimen (seed / formula /
jumlah DRS)."*

A `BenchmarkSnapshot` is a versioned, self-describing measurement:

    benchmark version | seed | waves | drs rounds | holdout size | judge |
    planner | cold success | warm success | avg scores | memory size |
    coverage | timestamp

Snapshots are written to `runs/benchmarks/<name>.json` and compared pairwise.
Comparing results from incompatible environments is refused: the environment
fingerprint (python version, benchmark version, judge name, planner name) must
match, otherwise the diff is reported as INCOMPARABLE rather than silently
presented as a delta (EVALUATION.md §Benchmark integrity).
"""
from __future__ import annotations

import json
import platform
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Sequence

from .orchestrator import RSIOrchestrator

BENCHMARK_SUITE_VERSION = "rsi-bench-1"

# Metrics that must match before two snapshots may be compared at all.
_COMPARABLE_ENV_KEYS = ("benchmark_suite_version", "python", "judge", "planner")


@dataclass
class BenchmarkConfig:
    """One experiment arm (a 'branch' of the experiment matrix)."""

    name: str
    seed: int = 0
    waves: int = 2
    tasks_per_wave: int = 6
    drs_rounds: int = 2
    drs_tasks: int = 4
    holdout: int = 12
    backend: str = "mock"
    jev: str = "mock"
    improve_between_waves: bool = False
    improvement_cycles: int = 1

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class BenchmarkSnapshot:
    name: str
    config: dict[str, Any]
    environment: dict[str, Any]
    metrics: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "config": self.config,
            "environment": self.environment,
            "metrics": self.metrics,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BenchmarkSnapshot":
        return cls(
            name=str(data.get("name", "unnamed")),
            config=dict(data.get("config", {})),
            environment=dict(data.get("environment", {})),
            metrics=dict(data.get("metrics", {})),
            created_at=float(data.get("created_at", 0.0)),
        )


def _environment(jev: Any, planner_factory: Any) -> dict[str, Any]:
    return {
        "benchmark_suite_version": BENCHMARK_SUITE_VERSION,
        "python": platform.python_version(),
        "judge": getattr(jev, "name", type(jev).__name__),
        "planner": getattr(planner_factory, "__name__", str(planner_factory)),
    }


def run_benchmark(
    config: BenchmarkConfig,
    *,
    runs_dir: str | Path = "runs",
    improvement_limits=None,
    approval=None,
    log=lambda _msg: None,
) -> BenchmarkSnapshot:
    """Run one full exploration -> improve -> freeze -> evaluate cycle."""
    from .jev import get_jev
    from .planners import mock_planner_factory, openai_planner_factory

    jev = get_jev(config.jev)
    planner_factory = (
        openai_planner_factory() if config.backend == "openai" else mock_planner_factory
    )
    orchestrator = RSIOrchestrator(
        runs_dir=Path(runs_dir) / config.name,
        jev=jev,
        planner_factory=planner_factory,
        seed=config.seed,
        log=log,
    )
    orchestrator.explore(
        waves=config.waves,
        tasks_per_wave=config.tasks_per_wave,
        drs_rounds=config.drs_rounds,
        drs_tasks=config.drs_tasks,
        improve_between_waves=config.improve_between_waves,
        improvement_limits=improvement_limits,
        approval=approval,
    )
    orchestrator.freeze()
    orchestrator.evaluate(n=config.holdout)
    orchestrator.report()

    cold = orchestrator.phase_stats.get("TEST cold (empty memory)", {})
    warm = orchestrator.phase_stats.get("TEST warm (frozen memory)", {})
    metrics = {
        "cold_success_rate": cold.get("success_rate", 0.0),
        "warm_success_rate": warm.get("success_rate", 0.0),
        "cold_avg_score": cold.get("avg_score", 0.0),
        "warm_avg_score": warm.get("avg_score", 0.0),
        "success_rate_delta": round(
            warm.get("success_rate", 0.0) - cold.get("success_rate", 0.0), 4
        ),
        "memory_lessons": len(orchestrator.memory),
        "knowledge_keys": len(orchestrator.memory.keys()),
        "escalated_total": len(orchestrator.escalations),
        "loop_health": orchestrator.loop_health,
    }
    return BenchmarkSnapshot(
        name=config.name,
        config=config.to_dict(),
        environment=_environment(jev, planner_factory),
        metrics=metrics,
    )


def save_snapshot(snapshot: BenchmarkSnapshot, directory: str | Path) -> Path:
    path = Path(directory) / f"{snapshot.name}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot.to_dict(), indent=2), encoding="utf-8")
    return path


def load_snapshot(path: str | Path) -> BenchmarkSnapshot:
    return BenchmarkSnapshot.from_dict(
        json.loads(Path(path).read_text(encoding="utf-8"))
    )


def comparability(snapshot_a: BenchmarkSnapshot,
                  snapshot_b: BenchmarkSnapshot) -> tuple[bool, list[str]]:
    """Two snapshots are comparable only in the same benchmark environment."""
    problems: list[str] = []
    for key in _COMPARABLE_ENV_KEYS:
        left = snapshot_a.environment.get(key)
        right = snapshot_b.environment.get(key)
        if left != right:
            problems.append(f"{key}: {left!r} != {right!r}")
    return (not problems, problems)


def compare_snapshots(a: BenchmarkSnapshot, b: BenchmarkSnapshot) -> str:
    """Markdown diff of two snapshots; refuses to compare across environments."""
    ok, problems = comparability(a, b)
    lines = [
        f"# Benchmark comparison: `{a.name}` vs `{b.name}`",
        "",
        f"- benchmark suite: `{BENCHMARK_SUITE_VERSION}`",
        f"- environments: `{a.environment.get('python')}` / "
        f"`{b.environment.get('python')}`, judge "
        f"`{a.environment.get('judge')}` / `{b.environment.get('judge')}`",
        "",
    ]
    if not ok:
        lines += [
            "**INCOMPARABLE** -- the two snapshots were produced in different "
            "benchmark environments, so their numbers must not be read as a "
            "delta:",
            "",
        ]
        lines += [f"- {problem}" for problem in problems]
        return "\n".join(lines) + "\n"

    keys = sorted(set(a.metrics) | set(b.metrics))
    lines += [
        "| Metric | " + a.name + " | " + b.name + " | Delta |",
        "|---|---|---|---|",
    ]
    for key in keys:
        if key == "loop_health":
            continue
        left = a.metrics.get(key, 0.0)
        right = b.metrics.get(key, 0.0)
        if isinstance(left, (int, float)) and isinstance(right, (int, float)):
            lines.append(f"| {key} | {left:.4f} | {right:.4f} | {right - left:+.4f} |")
        else:
            lines.append(f"| {key} | {left} | {right} | - |")
    lines.append("")
    return "\n".join(lines)


DEFAULT_MATRIX: tuple[BenchmarkConfig, ...] = (
    BenchmarkConfig(name="baseline-seed0", seed=0),
    BenchmarkConfig(name="baseline-seed7", seed=7),
    BenchmarkConfig(name="deep-seed0", seed=0, drs_rounds=3),
    BenchmarkConfig(name="improved-seed0", seed=0, improve_between_waves=True),
)


def run_matrix(
    configs: Sequence[BenchmarkConfig] = DEFAULT_MATRIX,
    *,
    runs_dir: str | Path = "runs",
    improvement_limits=None,
    approval=None,
    log=lambda _msg: None,
) -> list[BenchmarkSnapshot]:
    """Run a set of experiment arms and persist every snapshot."""
    directory = Path(runs_dir) / "benchmarks"
    directory.mkdir(parents=True, exist_ok=True)
    snapshots: list[BenchmarkSnapshot] = []
    for config in configs:
        log(f"[benchmark] running {config.name} ...")
        snapshot = run_benchmark(
            config, runs_dir=runs_dir, improvement_limits=improvement_limits,
            approval=approval, log=log,
        )
        save_snapshot(snapshot, directory)
        snapshots.append(snapshot)
        log(
            f"[benchmark] {config.name}: cold "
            f"{snapshot.metrics['cold_success_rate'] * 100:.0f}% -> warm "
            f"{snapshot.metrics['warm_success_rate'] * 100:.0f}% "
            f"(memory {snapshot.metrics['memory_lessons']} lessons)"
        )
    return snapshots


def render_matrix(snapshots: Sequence[BenchmarkSnapshot]) -> str:
    lines = [
        "# Benchmark matrix",
        "",
        "| Arm | Seed | Waves | DRS | Holdout | Cold | Warm | Delta | Memory | Keys |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for snapshot in snapshots:
        config = snapshot.config
        metrics = snapshot.metrics
        lines.append(
            f"| {snapshot.name} | {config.get('seed')} | {config.get('waves')} "
            f"| {config.get('drs_rounds')} | {config.get('holdout')} "
            f"| {metrics.get('cold_success_rate', 0) * 100:.0f}% "
            f"| {metrics.get('warm_success_rate', 0) * 100:.0f}% "
            f"| {metrics.get('success_rate_delta', 0):+.2f} "
            f"| {metrics.get('memory_lessons', 0)} "
            f"| {metrics.get('knowledge_keys', 0)} |"
        )
    lines.append("")
    return "\n".join(lines)
