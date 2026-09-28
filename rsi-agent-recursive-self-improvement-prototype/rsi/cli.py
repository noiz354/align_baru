"""Command-line interface for the RSI prototype.

    python -m rsi.cli run          # full offline run: explore -> improve -> freeze -> evaluate
    python -m rsi.cli improve      # run the bounded improvement loop on existing memory
    python -m rsi.cli benchmark    # snapshot metrics across an experiment matrix
    python -m rsi.cli dashboard    # render runs/dashboard.html
    python -m rsi.cli skills       # export memory -> SKILL.md / CLAUDE.md
    python -m rsi.cli rao          # self-assess the run and rewrite the skill files
    python -m rsi.cli audit        # verify the hash-chained audit trail
    python -m rsi.cli status       # one-screen state of the last run

Everything is offline and stdlib-only unless a real backend is explicitly
requested (`--backend openai` or RSI_PROVIDER=openai-compatible), in which case the
corresponding API key must come from the environment -- never from a flag.
RSI_PROVIDER wins over --backend. Mock is the default offline provider.
Real provider requires human approval (auto-approve is disabled).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Sequence

from .audit import AuditLog
from .curriculum import CurriculumAgent
from .jev import get_jev
from .memory import PersistentMemory
from .orchestrator import RSIOrchestrator
from .planners import mock_planner_factory, openai_planner_factory

try:
    from .providers import get_provider
except Exception:
    get_provider = None  # type: ignore


# ---------------------------------------------------------------------------
# Shared wiring
# ---------------------------------------------------------------------------
def _resolve_provider_name(backend: str, provider_flag: str | None = None) -> str:
    # precedence: --provider flag > RSI_PROVIDER env > --backend legacy
    if provider_flag:
        return provider_flag
    env = os.environ.get("RSI_PROVIDER", "").strip()
    if env:
        return env
    return "openai-compatible" if backend == "openai" else "mock"


def _planner_factory(backend: str, provider_flag: str | None = None):
    name = _resolve_provider_name(backend, provider_flag)
    low = name.strip().lower()
    if low in ("", "mock", "mock-provider"):
        return mock_planner_factory
    if low in ("openai", "openai-compatible", "real", "vllm", "ollama"):
        return openai_planner_factory()
    # unknown: fall back to mock but audit will record config error
    return mock_planner_factory


def _resolve_provider(backend: str, provider_flag: str | None = None):
    if get_provider is None:
        return None
    name = _resolve_provider_name(backend, provider_flag)
    try:
        return get_provider(name)
    except Exception as exc:
        # Fail-closed for real without key: return None and let improve() audit it
        if name.strip().lower() not in ("mock", "", "mock-provider"):
            print(f"provider misconfigured: {exc}", file=sys.stderr)
        return None


def _orchestrator(args: Any, *, seed: int = 0) -> RSIOrchestrator:
    backend = getattr(args, "backend", "mock")
    provider_flag = getattr(args, "provider", None)
    # Log provider boundary
    try:
        prov = _resolve_provider(backend, provider_flag)
        prov_id = getattr(prov, "provider_id", provider_flag or backend)
        prov_model = getattr(prov, "model", os.environ.get("RSI_MODEL") or os.environ.get("OPENAI_MODEL") or "mock-model")
        print(f"PROVIDER: {prov_id} model={prov_model} (backend={backend}, RSI_PROVIDER={os.environ.get('RSI_PROVIDER','') or 'mock'})")
    except Exception:
        pass
    return RSIOrchestrator(
        runs_dir=args.runs_dir,
        jev=get_jev(getattr(args, "jev", "mock")),
        planner_factory=_planner_factory(backend, provider_flag),
        seed=seed,
        resume=getattr(args, "resume", False),
        log=print,
    )


def _improvement_limits(args: Any):
    from .improvement import ImprovementLimits

    return ImprovementLimits(
        max_cycles=getattr(args, "max_cycles", 3),
        max_proposals_per_cycle=getattr(args, "max_proposals", 4),
        max_candidates_per_cycle=getattr(args, "max_candidates", 3),
        max_changed_lessons=getattr(args, "max_lessons", 2),
        max_diff_lines=getattr(args, "max_diff_lines", 200),
        max_wall_clock_seconds=getattr(args, "max_seconds", 120.0),
        min_target_delta=getattr(args, "min_delta", 0.10),
        stagnation_window=getattr(args, "stagnation_window", 2),
    )


def _approval(args: Any, provider=None):
    from .improvement import ApprovalPolicy

    # Resolve provider for mandatory human gate
    if provider is None:
        provider = _resolve_provider(getattr(args, "backend", "mock"), getattr(args, "provider", None))
    policy = ApprovalPolicy(auto_approve=bool(getattr(args, "auto_approve", False)), provider=provider)
    if provider and getattr(provider, "provider_id", "") != "mock" and getattr(args, "auto_approve", False):
        print("note: --auto-approve is ignored for real provider (human gate mandatory)", file=sys.stderr)
    return policy


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
def cmd_run(args: Any) -> int:
    orchestrator = _orchestrator(args, seed=args.seed)
    print("=" * 72)
    print("RSI AGENT -- exploration (Curriculum -> Actor -> Verifier)")
    print("=" * 72)
    # Approval preview for between-wave improvement
    approval = _approval(args) if args.improve else None
    orchestrator.explore(
        waves=args.waves,
        tasks_per_wave=args.tasks_per_wave,
        drs_rounds=args.drs_rounds,
        drs_tasks=args.drs_tasks,
        improve_between_waves=args.improve,
        improvement_limits=_improvement_limits(args) if args.improve else None,
        approval=approval,
    )
    if args.improve:
        print("-" * 72)
        print("RSI AGENT -- improvement loop (propose -> isolate -> evaluate -> apply)")
        print("-" * 72)
        provider = _resolve_provider(getattr(args, "backend", "mock"), getattr(args, "provider", None))
        orchestrator.improve(
            max_cycles=args.max_cycles,
            limits=_improvement_limits(args),
            approval=_approval(args, provider=provider),
            provider=provider,
        )
    print("-" * 72)
    orchestrator.freeze()
    print("-" * 72)
    print("RSI AGENT -- test-time evaluation (frozen memory, no writes)")
    print("-" * 72)
    orchestrator.evaluate(n=args.holdout)
    report = orchestrator.report()
    print("-" * 72)
    print(f"HEADLINE: {orchestrator.headline()}")
    print(f"REPORT:   {report}")
    if args.improve and orchestrator.improvement_loop is not None:
        audit_ok, problems = orchestrator.improvement_loop.audit.verify_chain()
        print(f"AUDIT:    {'chain intact' if audit_ok else 'CHAIN BROKEN'} "
              f"({len(orchestrator.improvement_loop.audit)} events)")
        for problem in problems:
            print(f"  ! {problem}")
    try:
        from rsi.dashboard import build_dashboard

        print(f"DASHBOARD:{build_dashboard(args.runs_dir)}")
    except Exception as exc:                       # noqa: BLE001
        print(f"DASHBOARD: not generated ({exc})")
    return 0


def cmd_improve(args: Any) -> int:
    memory_path = Path(args.runs_dir) / "memory.json"
    if not memory_path.exists():
        print(f"no memory store at {memory_path}; run `python -m rsi.cli run` first",
              file=sys.stderr)
        return 2
    # `resume=True` so the existing store is *continued*, not archived away:
    # improving a memory that was just thrown out would be meaningless.
    args.resume = True
    orchestrator = _orchestrator(args, seed=args.seed)
    if orchestrator.memory.frozen:
        orchestrator.memory.unfreeze()
    # Rebuild evidence from the recorded attempts so the loop has something to
    # work with even across processes.
    from .types import Attempt

    attempts = [
        Attempt(**{k: v for k, v in record.items() if k in Attempt.__dataclass_fields__})
        for record in _read_jsonl(Path(args.runs_dir) / "attempts.jsonl")
    ]
    provider = _resolve_provider(getattr(args, "backend", "mock"), getattr(args, "provider", None))
    cycles = orchestrator.improve(
        max_cycles=args.max_cycles,
        limits=_improvement_limits(args),
        approval=_approval(args, provider=provider),
        provider=provider,
    )
    orchestrator.report()
    if not cycles:
        print("improvement loop did not run (memory frozen or no evidence)")
        return 1
    print(f"improvement loop finished: {len(cycles)} cycle(s), "
          f"stop reason: {orchestrator.improvement_loop.stop_reason or 'none'}")
    return 0


def cmd_benchmark(args: Any) -> int:
    from .benchmark import (
        BenchmarkConfig, render_matrix, run_matrix, save_snapshot,
    )

    if args.quick:
        configs = [
            BenchmarkConfig(name="baseline-seed0", seed=0, waves=1,
                            drs_rounds=1, holdout=6),
            BenchmarkConfig(name="improved-seed0", seed=0, waves=1, drs_rounds=1,
                            holdout=6, improve_between_waves=True),
        ]
    else:
        from .benchmark import DEFAULT_MATRIX

        configs = list(DEFAULT_MATRIX)
    snapshots = run_matrix(
        configs, runs_dir=args.runs_dir, approval=_approval(args),
        log=print,
    )
    print(render_matrix(snapshots))
    for snapshot in snapshots:
        print(f"snapshot: {save_snapshot(snapshot, Path(args.runs_dir) / 'benchmarks')}")
    return 0


def cmd_dashboard(args: Any) -> int:
    from rsi.dashboard import build_dashboard

    path = build_dashboard(args.runs_dir, args.out)
    print(f"dashboard written to {path}")
    return 0


def cmd_skills(args: Any) -> int:
    from .skills import export_skills, skill_stats

    memory_path = Path(args.runs_dir) / "memory.json"
    if not memory_path.exists():
        print(f"no memory store at {memory_path}", file=sys.stderr)
        return 2
    memory = PersistentMemory(memory_path, restore_frozen=True)
    written = export_skills(memory, args.out_dir)
    for name, path in written.items():
        print(f"wrote {name} -> {path}")
    print(json.dumps(skill_stats(memory), indent=2))
    return 0


def cmd_rao(args: Any) -> int:
    from .rao import RAOLoop

    memory_path = Path(args.runs_dir) / "memory.json"
    if not memory_path.exists():
        print(f"no memory store at {memory_path}", file=sys.stderr)
        return 2
    memory = PersistentMemory(memory_path, restore_frozen=True)
    report_path = Path(args.runs_dir) / "report.md"
    report = report_path.read_text(encoding="utf-8") if report_path.exists() else ""
    loop = RAOLoop(
        memory, args.target_dir, jev=get_jev(args.jev),
        runs_dir=args.runs_dir,
        approval=(lambda _p, _r: (True, "auto-approved by CLI --auto-approve"))
        if args.auto_approve else None,
    )
    result = loop.run(report)
    print(json.dumps(result.to_dict(), indent=2))
    return 0 if result.outcome in ("APPLIED", "NOOP") else 1


def cmd_audit(args: Any) -> int:
    audit = AuditLog(Path(args.runs_dir) / "audit.jsonl")
    if args.verify:
        ok, problems = audit.verify_chain()
        print(f"audit chain: {'INTACT' if ok else 'BROKEN'} "
              f"({len(audit)} events)")
        for problem in problems:
            print(f"  ! {problem}")
        return 0 if ok else 1
    for event in audit.events():
        print(f"{event.ts:>12.3f}  {event.kind:<28} {event.proposal_id or '-'}")
    return 0


def cmd_status(args: Any) -> int:
    from .dashboard import DashboardData

    data = DashboardData(args.runs_dir)
    cycles = data.cycles.get("cycles", [])
    accepted = sum(len(c.get("accepted", [])) for c in cycles)
    rejected = sum(len(c.get("rejected", [])) for c in cycles)
    escalated = sum(len(c.get("escalated", [])) for c in cycles)
    rolled_back = sum(len(c.get("rolled_back", [])) for c in cycles)
    ok, _problems = data.audit_chain_ok()
    active = [l for l in data.memory_lessons if not l.get("deprecated")]
    keys = sorted({k for l in active for k in l.get("knowledge_keys", [])})
    print(f"runs dir          : {args.runs_dir}")
    print(f"memory lessons    : {len(active)} active "
          f"({len(data.memory_lessons)} stored, "
          f"{len(data.memory_lessons) - len(active)} deprecated)")
    print(f"knowledge keys    : {len(keys)}")
    print(f"memory frozen     : {data.memory.get('frozen', False)}")
    print(f"attempts traced   : {len(data.attempts)}")
    print(f"improvement cycles: {len(cycles)}")
    print(f"  accepted        : {accepted}")
    print(f"  rejected        : {rejected}")
    print(f"  escalated       : {escalated}")
    print(f"  rolled back     : {rolled_back}")
    print(f"audit events      : {len(data.audit_events)} "
          f"(chain {'intact' if ok else 'BROKEN'})")
    print(f"stop reason       : {data.cycles.get('stop_reason') or 'none'}")
    # Provider line
    try:
        prov = data.cycles.get("provider") or (data.audit_events[-1].get("details", {}).get("provider") if data.audit_events else None)
        if prov:
            print(f"provider          : {prov}")
    except Exception:
        pass
    return 0


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------
def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rsi",
        description="Bounded, auditable, reversible recursive self-improvement "
                    "prototype for coding agents (with provider boundary).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def add_common(p: argparse.ArgumentParser) -> None:
        p.add_argument("--runs-dir", default="runs")
        p.add_argument("--backend", choices=["mock", "openai"], default="mock",
                       help="legacy backend (RSI_PROVIDER wins)")
        p.add_argument("--provider", choices=["mock", "openai-compatible", "openai"], default=None,
                       help="explicit provider (overrides RSI_PROVIDER env)")
        p.add_argument("--jev", choices=["mock", "typesafe"], default="mock")
        p.add_argument("--resume", action="store_true")

    def add_limits(p: argparse.ArgumentParser) -> None:
        p.add_argument("--max-cycles", type=int, default=3)
        p.add_argument("--max-proposals", type=int, default=4)
        p.add_argument("--max-candidates", type=int, default=3)
        p.add_argument("--max-lessons", type=int, default=2)
        p.add_argument("--max-diff-lines", type=int, default=200)
        p.add_argument("--max-seconds", type=float, default=120.0)
        p.add_argument("--min-delta", type=float, default=0.10)
        p.add_argument("--stagnation-window", type=int, default=2)
        p.add_argument("--auto-approve", action="store_true",
                       help="waive the human gate for LOW/MEDIUM risk only (ignored for real provider)")

    run = sub.add_parser("run", help="full offline run")
    add_common(run)
    add_limits(run)
    run.add_argument("--waves", type=int, default=2)
    run.add_argument("--tasks-per-wave", type=int, default=6)
    run.add_argument("--drs-rounds", type=int, default=2)
    run.add_argument("--drs-tasks", type=int, default=4)
    run.add_argument("--holdout", type=int, default=12)
    run.add_argument("--seed", type=int, default=0)
    run.add_argument("--improve", action="store_true",
                     help="run the improvement loop during exploration")
    run.set_defaults(func=cmd_run)

    improve = sub.add_parser("improve", help="run the improvement loop")
    add_common(improve)
    add_limits(improve)
    improve.add_argument("--seed", type=int, default=0)
    improve.set_defaults(func=cmd_improve)

    bench = sub.add_parser("benchmark", help="snapshot metrics across arms")
    add_common(bench)
    bench.add_argument("--quick", action="store_true")
    bench.add_argument("--auto-approve", action="store_true")
    bench.set_defaults(func=cmd_benchmark)

    dash = sub.add_parser("dashboard", help="render the HTML dashboard")
    dash.add_argument("--runs-dir", default="runs")
    dash.add_argument("--out", default=None)
    dash.set_defaults(func=cmd_dashboard)

    skills = sub.add_parser("skills", help="export memory as Markdown skill files")
    skills.add_argument("--runs-dir", default="runs")
    skills.add_argument("--out-dir", default=".")
    skills.set_defaults(func=cmd_skills)

    rao = sub.add_parser("rao", help="self-assess and rewrite the skill files")
    rao.add_argument("--runs-dir", default="runs")
    rao.add_argument("--target-dir", default=".")
    rao.add_argument("--jev", choices=["mock", "typesafe"], default="mock")
    rao.add_argument("--auto-approve", action="store_true")
    rao.set_defaults(func=cmd_rao)

    audit = sub.add_parser("audit", help="inspect / verify the audit trail")
    audit.add_argument("--runs-dir", default="runs")
    audit.add_argument("--verify", action="store_true")
    audit.set_defaults(func=cmd_audit)

    status = sub.add_parser("status", help="one-screen state of the last run")
    status.add_argument("--runs-dir", default="runs")
    status.set_defaults(func=cmd_status)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args) or 0)


if __name__ == "__main__":
    sys.exit(main())
