"""RSI Orchestrator: closes the recursive self-improvement loop.

    ┌────────────────────────────────────────────────────────────┐
    │  EXPLORATION (writes memory)                               │
    │    BRS: broad, diverse tasks from a shared starting memory │
    │    DRS: focused tasks targeting weak knowledge keys        │
    │    per task: Jev(guard) -> Jev(route) -> Actor(ReAct)      │
    │                -> Jev(score + done) -> lesson -> memory    │
    │  FREEZE memory                                           │
    │  TEST-TIME (read-only memory, no writes)                   │
    │    holdout tasks: cold (empty memory) vs warm (frozen)     │
    └────────────────────────────────────────────────────────────┘

Every artifact that outlives a run is written under `runs/`:
    report.md      -- human-readable metrics + sample lessons
    memory.json    -- the persistent memory store (procedures/boundaries)
    attempts.jsonl -- full traces for benchmarking/dashboards
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Callable

from .actor import ActorAgent
from .curriculum import KNOWLEDGE_KEYS, CurriculumAgent
from .jev import JevClient, MockJev
from .memory import PersistentMemory
from .planners import mock_planner_factory
from .routing import OrchestrationLayer
from .types import Attempt, Task, Verdict
from .verifier import VerifierAgent


def summarize(attempts: list[Attempt]) -> dict:
    total = len(attempts)
    escalated = sum(1 for a in attempts if a.escalated)
    executed = [a for a in attempts if not a.escalated]
    wins = sum(1 for a in executed if a.success)
    avg_score = (sum(a.score for a in executed) / len(executed)) if executed else 0.0
    return {
        "tasks": total,
        "executed": len(executed),
        "escalated": escalated,
        "successes": wins,
        "success_rate": (wins / len(executed)) if executed else 0.0,
        "avg_score": round(avg_score, 3),
    }


def fmt_summary(tag: str, stats: dict) -> str:
    pct = stats["success_rate"] * 100
    esc = f" | escalated {stats['escalated']}" if stats["escalated"] else ""
    return (f"[{tag}] {stats['tasks']} tasks | success "
            f"{stats['successes']}/{stats['executed']} ({pct:.0f}%) | "
            f"avg score {stats['avg_score']:.2f}{esc}")


class RSIOrchestrator:
    def __init__(
        self,
        runs_dir: str | Path = "runs",
        jev: JevClient | None = None,
        planner_factory: Callable = mock_planner_factory,
        seed: int = 0,
        num_actors: int = 2,
        resume: bool = False,
        log: Callable[[str], None] = print,
    ):
        self.runs_dir = Path(runs_dir)
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        memory_path = self.runs_dir / "memory.json"
        self.log = log
        if not resume and memory_path.exists():
            backup = self.runs_dir / "memory.prev.json"
            memory_path.replace(backup)
            log(f"previous memory archived to {backup} "
                f"(pass resume=True / --resume to continue from it)")
        self.memory = PersistentMemory(memory_path)
        self.jev = jev or MockJev()
        self.routing = OrchestrationLayer(self.jev)
        self.curriculum = CurriculumAgent(seed=seed)
        self.verifier = VerifierAgent(self.jev)
        self.actors = [
            ActorAgent(f"actor-{i}", planner_factory, seed=seed)
            for i in range(num_actors)
        ]
        self.planner_factory = planner_factory
        self.seed = seed
        self.attempts: list[Attempt] = []
        self.escalations: list[dict] = []
        self._tasks_by_id: dict[str, Task] = {}
        self._task_counter = 0
        self.phase_stats: dict[str, dict] = {}

    # ------------------------------------------------------------------ core
    def _run_task(self, task: Task, memory: PersistentMemory,
                  write_lessons: bool) -> Attempt:
        self._tasks_by_id[task.id] = task
        decision = self.routing.route(task)

        if decision.is_human:
            record = self.routing.escalate(task, decision)
            self.escalations.append(record)
            attempt = Attempt(
                task_id=task.id, task_title=task.title, actor_id="human-workflow",
                route="human", phase=task.phase,
                steps=[f"guardrail: {decision.guard_rationale}",
                       "route: queued for human review (not executed autonomously)"],
                output="escalated to human workflow", success=False,
                score=0.0, done_confidence=0.0, escalated=True,
            )
            self.attempts.append(attempt)
            return attempt

        actor = self.actors[self._task_counter % len(self.actors)]
        self._task_counter += 1
        result = actor.run(task, memory, decision.route)
        verdict: Verdict = self.verifier.verify(task, result)

        if write_lessons and not memory.frozen:
            for lesson in verdict.lessons:
                memory.add(lesson)

        attempt = Attempt(
            task_id=task.id, task_title=task.title, actor_id=actor.actor_id,
            route=decision.route, phase=task.phase, steps=result.steps,
            output=result.output, success=verdict.success, score=verdict.score,
            done_confidence=verdict.done_confidence,
            failure_mode=result.failure_mode,
            lessons=[lesson.content for lesson in verdict.lessons],
        )
        self.attempts.append(attempt)
        return attempt

    def _run_tasks(self, tasks: list[Task], memory: PersistentMemory,
                   write_lessons: bool, tag: str) -> dict:
        batch: list[Attempt] = []
        for task in tasks:
            batch.append(self._run_task(task, memory, write_lessons))
        stats = summarize(batch)
        stats["lessons_in_memory"] = len(memory)
        self.phase_stats[tag] = stats
        self.log(f"{fmt_summary(tag, stats)} | memory {len(memory)} lessons")
        return stats

    def _weak_keys(self) -> set[str]:
        """Keys implicated in failures (observed failure modes + unmet requirements)."""
        weak: set[str] = set()
        for attempt in self.attempts:
            if attempt.success or attempt.escalated:
                continue
            if attempt.failure_mode:
                weak.add(attempt.failure_mode)
            task = self._tasks_by_id.get(attempt.task_id)
            if task:
                weak.update(k for k in task.required_knowledge
                            if k not in self.memory.keys())
        return weak or set(KNOWLEDGE_KEYS[:4])

    # ------------------------------------------------------------- lifecycle
    def explore(self, waves: int = 2, tasks_per_wave: int = 6,
                drs_rounds: int = 2, drs_tasks: int = 4) -> None:
        """BRS then DRS -- writes lessons to persistent memory."""
        for wave in range(waves):
            tasks = self.curriculum.propose_broad(tasks_per_wave, wave)
            self._run_tasks(tasks, self.memory, write_lessons=True,
                            tag=f"BRS wave {wave + 1}/{waves}")
        for round_no in range(drs_rounds):
            weak = self._weak_keys()
            tasks = self.curriculum.propose_deep(drs_tasks, weak, round_no)
            self._run_tasks(tasks, self.memory, write_lessons=True,
                            tag=f"DRS round {round_no + 1}/{drs_rounds}")

    def freeze(self) -> None:
        self.memory.freeze()
        self.log(f"memory FROZEN at {len(self.memory)} lessons "
                 f"({len(self.memory.keys())} knowledge keys) -- test-time begins")

    def evaluate(self, n: int = 6) -> dict:
        """Test-time: identical holdout tasks, cold vs warm (frozen) memory."""
        holdout = self.curriculum.holdout(n, split="final")
        self._run_tasks(holdout, PersistentMemory(None), write_lessons=False,
                        tag="TEST cold (empty memory)")
        warm_stats = self._run_tasks(holdout, self.memory, write_lessons=False,
                                     tag="TEST warm (frozen memory)")
        return warm_stats

    # ---------------------------------------------------------------- report
    def report(self) -> Path:
        stamp = time.strftime("%Y-%m-%d %H:%M:%S")
        cold = self.phase_stats.get("TEST cold (empty memory)", {})
        warm = self.phase_stats.get("TEST warm (frozen memory)", {})
        lines = [
            "# RSI Agent -- Run Report",
            "",
            f"_Generated: {stamp} | seed: {self.seed} | "
            f"judge: {getattr(self.jev, 'name', type(self.jev).__name__)}_",
            "",
            "## Architecture executed",
            "",
            "```",
            "Curriculum Agent ──propose──► Actor Agent (ReAct loop) ──result──► Verifier Agent",
            "       ▲                                                              │",
            "       └──────────────── persistent memory ◄── lesson ────────────────┘",
            "        BRS (broad) → DRS (deep, targeted at weak keys) → FREEZE → test-time",
            "  Jev decisions: guard(Noul) · route(Choice) · score(Score) · done(Noul)",
            "```",
            "",
            "## Phase metrics",
            "",
            "| Phase | Tasks | Success | Rate | Avg score | Escalated | Memory |",
            "|---|---|---|---|---|---|---|",
        ]
        for tag, stats in self.phase_stats.items():
            lines.append(
                f"| {tag} | {stats['tasks']} | {stats['successes']}/{stats['executed']} "
                f"| {stats['success_rate'] * 100:.0f}% | {stats['avg_score']:.2f} "
                f"| {stats['escalated']} | {stats.get('lessons_in_memory', '-')} |"
            )

        lines += [
            "",
            "## Cold vs warm (identical holdout tasks)",
            "",
            "| Condition | Success rate | Avg score |",
            "|---|---|---|",
            f"| Cold (empty memory) | {cold.get('success_rate', 0) * 100:.0f}% "
            f"| {cold.get('avg_score', 0):.2f} |",
            f"| Warm (frozen memory) | {warm.get('success_rate', 0) * 100:.0f}% "
            f"| {warm.get('avg_score', 0):.2f} |",
            "",
            "The delta is the RSI effect: experience written during exploration is "
            "reused verbatim at test time, with model parameters untouched.",
            "",
            f"## Persistent memory ({len(self.memory)} lessons, "
            f"frozen={self.memory.frozen})",
            "",
            f"Knowledge keys covered ({len(self.memory.keys())}): "
            f"{', '.join(sorted(self.memory.keys()))}",
            "",
        ]

        lines.append("### Sample verified lessons")
        for lesson in self.memory._lessons[:6]:
            lines.append(f"- `{lesson.kind}` (conf {lesson.confidence:.1f}, "
                         f"keys: {', '.join(lesson.knowledge_keys)}): {lesson.content}")

        if self.escalations:
            lines += ["", "## Escalated to human workflow", ""]
            for record in self.escalations:
                lines.append(f"- **{record['title']}** -- {record['reason']}")

        lines += [
            "",
            "## Artifacts",
            "",
            "- `runs/memory.json` -- persistent memory store (procedures + boundary lessons)",
            "- `runs/attempts.jsonl` -- full ReAct traces per attempt",
            "- `runs/report.md` -- this file",
            "",
        ]
        report_path = self.runs_dir / "report.md"
        report_path.write_text("\n".join(lines), encoding="utf-8")

        attempts_path = self.runs_dir / "attempts.jsonl"
        with attempts_path.open("w", encoding="utf-8") as fh:
            for attempt in self.attempts:
                fh.write(json.dumps(attempt.to_dict()) + "\n")

        self.memory.save()
        self.log(f"report written to {report_path}")
        return report_path

    def headline(self) -> str:
        cold = self.phase_stats.get("TEST cold (empty memory)", {})
        warm = self.phase_stats.get("TEST warm (frozen memory)", {})
        return (
            f"cold success {cold.get('success_rate', 0) * 100:.0f}% -> "
            f"warm success {warm.get('success_rate', 0) * 100:.0f}% "
            f"on identical holdout tasks (memory: {len(self.memory)} lessons)"
        )
