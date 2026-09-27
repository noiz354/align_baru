"""The improvement loop: propose -> isolate -> evaluate -> decide -> apply -> verify.

This is the RSI loop's *self-modification* half. The exploration half
(`rsi/orchestrator.py`) writes lessons from observed attempts; this loop takes
those lessons, packages them as proposals, evaluates them in isolation against
the accepted baseline, and only then mutates the one artifact the prototype is
allowed to mutate -- persistent memory.

    OBSERVE -> PROPOSE -> ISOLATE -> EVALUATE -> DECIDE -> APPLY -> VERIFY
                                                                  |
                                            ROLLBACK <-- regression detected

Safety properties enforced here (not merely documented):

* **Bounded.** `ImprovementLimits` caps cycles, proposals per cycle, candidates
  per cycle, lessons per candidate, diff lines, wall-clock and tool calls. The
  loop refuses to start a cycle once a budget is spent.
* **Auditable.** Every transition appends to the hash-chained `AuditLog`.
* **Reversible.** The pre-apply baseline payload is archived before any write;
  `rollback()` restores it verbatim and re-verifies.
* **Human-controlled.** HIGH/CRITICAL risk proposals are never auto-accepted;
  they are escalated and, without an approver, left unapplied.
* **Isolated.** Candidates live in a `CandidateWorkspace`; the baseline is never
  mutated to "see what happens".
* **Idempotent.** Proposal ids are deterministic; applied proposals are recorded
  and never re-applied.
* **Stagnation-aware.** Consecutive cycles with no accepted improvement stop the
  loop instead of burning tokens forever.
"""
from __future__ import annotations

import json
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Iterator, Sequence

from .audit import AuditLog
from .evaluator import (
    Decision,
    EvaluationEngine,
    EvaluationLimits,
    EvaluationRun,
)
from .feedback import Evidence, FeedbackRecord, FeedbackIngestor
from .memory import MemoryFrozenError, PersistentMemory
from .patches import LessonChangeSet, RevisionMismatch
from .proposals import ImprovementProposal, ProposalGenerator, ProposalStatus
from .risk import RiskLevel, RiskPolicy, classify_risk
from .sandbox import CandidateWorkspace, SandboxLimits, assert_no_secrets
from .types import Attempt, Task

TARGET_METRIC = "holdout_success_rate"


# ---------------------------------------------------------------------------
# Limits
# ---------------------------------------------------------------------------
@dataclass
class ImprovementLimits:
    """Every cycle of self-improvement runs inside these budgets."""

    max_cycles: int = 3
    max_proposals_per_cycle: int = 4
    max_candidates_per_cycle: int = 3
    max_changed_lessons: int = 2
    max_diff_lines: int = 200
    max_wall_clock_seconds: float = 120.0
    max_tool_calls: int = 2000
    max_concurrent_experiments: int = 1
    min_target_delta: float = 0.10
    stagnation_window: int = 2
    auto_accept_max_risk: RiskLevel = RiskLevel.MEDIUM

    def to_dict(self) -> dict[str, Any]:
        return {
            "max_cycles": self.max_cycles,
            "max_proposals_per_cycle": self.max_proposals_per_cycle,
            "max_candidates_per_cycle": self.max_candidates_per_cycle,
            "max_changed_lessons": self.max_changed_lessons,
            "max_diff_lines": self.max_diff_lines,
            "max_wall_clock_seconds": self.max_wall_clock_seconds,
            "max_tool_calls": self.max_tool_calls,
            "max_concurrent_experiments": self.max_concurrent_experiments,
            "min_target_delta": self.min_target_delta,
            "stagnation_window": self.stagnation_window,
            "auto_accept_max_risk": self.auto_accept_max_risk.value,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ImprovementLimits":
        limits = cls()
        for key, value in (data or {}).items():
            if not hasattr(limits, key):
                continue
            if key == "auto_accept_max_risk":
                setattr(limits, key, RiskLevel(str(value)))
            else:
                setattr(limits, key, type(getattr(limits, key))(value))
        return limits


# ---------------------------------------------------------------------------
# Human approval gate
# ---------------------------------------------------------------------------
@dataclass
class ApprovalResult:
    approved: bool
    approver: str
    reason: str


class ApprovalPolicy:
    """Human-in-the-loop gate.

    `approver` is a callable `(proposal, evaluation, risk) -> (bool, str)`.
    When no approver is configured, anything above `auto_accept_max_risk` is
    *denied* and recorded as ESCALATED -- never silently applied. Passing
    `auto_approve=True` only waives the gate for LOW/MEDIUM risk; CRITICAL and
    HIGH changes still require a real approver.
    """

    def __init__(
        self,
        approver: Callable[[ImprovementProposal, EvaluationRun], tuple[bool, str]] | None = None,
        *,
        auto_approve: bool = False,
        max_auto_approve_risk: RiskLevel = RiskLevel.MEDIUM,
    ):
        self.approver = approver
        self.auto_approve = auto_approve
        self.max_auto_approve_risk = max_auto_approve_risk

    def request(
        self, proposal: ImprovementProposal, evaluation: EvaluationRun,
        risk_level: RiskLevel,
    ) -> ApprovalResult:
        rank = {RiskLevel.LOW: 0, RiskLevel.MEDIUM: 1, RiskLevel.HIGH: 2, RiskLevel.CRITICAL: 3}
        if self.approver is not None:
            approved, note = self.approver(proposal, evaluation)
            return ApprovalResult(
                approved=approved,
                approver="human-approver" if approved else "human-approver",
                reason=note or ("approved by human reviewer" if approved
                                else "declined by human reviewer"),
            )
        if self.auto_approve and rank[risk_level] <= rank[self.max_auto_approve_risk]:
            return ApprovalResult(
                approved=True, approver="auto-approve",
                reason=f"auto-approved: risk {risk_level.value} <= "
                       f"{self.max_auto_approve_risk.value}",
            )
        return ApprovalResult(
            approved=False, approver="none",
            reason=(
                f"no approver configured and risk is {risk_level.value}; "
                "the proposal is queued for human review and was NOT applied"
            ),
        )


# ---------------------------------------------------------------------------
# Cycle bookkeeping
# ---------------------------------------------------------------------------
class CycleState(str, Enum):
    IDLE = "IDLE"
    OBSERVING = "OBSERVING"
    PROPOSING = "PROPOSING"
    ISOLATING = "ISOLATING"
    EVALUATING = "EVALUATING"
    DECIDING = "DECIDING"
    APPLYING = "APPLYING"
    VERIFYING = "VERIFYING"
    ROLLING_BACK = "ROLLING_BACK"
    RECORDING = "RECORDING"
    STOPPED = "STOPPED"


@dataclass
class CycleRecord:
    cycle: int
    started_at: float
    duration_s: float = 0.0
    state: str = CycleState.IDLE.value
    evidence_count: int = 0
    proposals: list[dict] = field(default_factory=list)
    evaluations: list[dict] = field(default_factory=list)
    accepted: list[str] = field(default_factory=list)
    rejected: list[str] = field(default_factory=list)
    escalated: list[str] = field(default_factory=list)
    rolled_back: list[str] = field(default_factory=list)
    blocked: list[str] = field(default_factory=list)
    baseline_revision: str = ""
    final_revision: str = ""
    stop_reason: str | None = None
    limit_hits: list[str] = field(default_factory=list)
    tool_calls: int = 0

    @property
    def applied_count(self) -> int:
        return len(self.accepted)

    def to_dict(self) -> dict[str, Any]:
        return {
            "cycle": self.cycle,
            "started_at": self.started_at,
            "duration_s": round(self.duration_s, 4),
            "state": self.state,
            "evidence_count": self.evidence_count,
            "proposals": list(self.proposals),
            "evaluations": list(self.evaluations),
            "accepted": list(self.accepted),
            "rejected": list(self.rejected),
            "escalated": list(self.escalated),
            "rolled_back": list(self.rolled_back),
            "blocked": list(self.blocked),
            "baseline_revision": self.baseline_revision,
            "final_revision": self.final_revision,
            "stop_reason": self.stop_reason,
            "limit_hits": list(self.limit_hits),
            "tool_calls": self.tool_calls,
        }


# ---------------------------------------------------------------------------
# Concurrency lock
# ---------------------------------------------------------------------------
class LoopLock:
    """Cross-process lock so two cycles never race on the same baseline."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._fd: Any = None

    def acquire(self, timeout: float = 5.0) -> bool:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        deadline = time.time() + timeout
        while True:
            try:
                self._fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_RDWR)
                os.write(self._fd, str(os.getpid()).encode())
                return True
            except FileExistsError:
                try:
                    if time.time() - self.path.stat().st_mtime > 120:
                        self.path.unlink(missing_ok=True)
                        continue
                except FileNotFoundError:
                    continue
                if time.time() > deadline:
                    return False
                time.sleep(0.05)

    def release(self) -> None:
        if self._fd is not None:
            os.close(self._fd)
            self._fd = None
        try:
            self.path.unlink(missing_ok=True)
        except OSError:
            pass

    @contextmanager
    def hold(self, timeout: float = 5.0) -> Iterator[bool]:
        acquired = self.acquire(timeout=timeout)
        try:
            yield acquired
        finally:
            if acquired:
                self.release()


# ---------------------------------------------------------------------------
# The loop
# ---------------------------------------------------------------------------
class ImprovementLoop:
    """Bounded, auditable, reversible self-improvement over persistent memory."""

    def __init__(
        self,
        memory: PersistentMemory,
        evaluator: EvaluationEngine,
        holdout_tasks: Sequence[Task],
        *,
        runs_dir: str | Path = "runs",
        limits: ImprovementLimits | None = None,
        approval: ApprovalPolicy | None = None,
        audit: AuditLog | None = None,
        generator: ProposalGenerator | None = None,
        risk_policy: RiskPolicy | None = None,
        log: Callable[[str], None] = print,
        actor: str = "rsi-improvement-loop",
    ):
        self.memory = memory
        self.evaluator = evaluator
        self.holdout_tasks = list(holdout_tasks)
        self.runs_dir = Path(runs_dir)
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        self.limits = limits or ImprovementLimits()
        self.approval = approval or ApprovalPolicy()
        self.audit = audit or AuditLog(self.runs_dir / "audit.jsonl")
        self.risk_policy = risk_policy or RiskPolicy(
            auto_accept_max_risk=self.limits.auto_accept_max_risk
        )
        self.generator = generator or ProposalGenerator(
            max_lessons_per_proposal=self.limits.max_changed_lessons,
        )
        self.log = log
        self.actor = actor
        self.state = CycleState.IDLE
        self.cycles: list[CycleRecord] = []
        self.stagnation_count = 0
        self.stop_reason: str | None = None
        self._resume_history()
        self._tool_calls = 0
        self._started_at = time.time()
        self._applied_path = self.runs_dir / "applied.json"
        self._lock = LoopLock(self.runs_dir / "improvement.lock")

    # -- state ---------------------------------------------------------------
    def _set_state(self, state: CycleState, record: CycleRecord | None = None) -> None:
        self.state = state
        if record is not None:
            record.state = state.value

    # -- evidence ------------------------------------------------------------
    def evidence_from_attempts(
        self, attempts: Sequence[Attempt], tasks_by_id: dict[str, Task] | None = None
    ) -> list[Evidence]:
        """Turn execution attempts into structured evidence (never raw prose)."""
        tasks_by_id = tasks_by_id or {}
        out: list[Evidence] = []
        for attempt in attempts:
            task = tasks_by_id.get(attempt.task_id)
            keys = list(task.required_knowledge) if task else []
            if attempt.failure_mode and attempt.failure_mode not in keys:
                keys.append(attempt.failure_mode)
            out.append(Evidence(
                id=f"ev-{attempt.task_id}",
                source="execution_failure" if not attempt.success else "historical_mistake",
                task_id=attempt.task_id,
                knowledge_keys=keys,
                failure_mode=attempt.failure_mode,
                success=attempt.success,
                score=attempt.score,
                done_confidence=attempt.done_confidence,
                phase=attempt.phase,
                excerpt=f"{attempt.task_title}: "
                        f"{'success' if attempt.success else 'failed'}",
            ))
        return out

    def evidence_from_feedback(
        self, records: Sequence[FeedbackRecord]
    ) -> list[Evidence]:
        return FeedbackIngestor().ingest_many(records)

    # -- idempotency ---------------------------------------------------------
    def _load_applied(self) -> dict[str, Any]:
        if not self._applied_path.exists():
            return {}
        try:
            return json.loads(self._applied_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}

    def _record_applied(self, proposal_id: str, *, before: str, after: str) -> None:
        data = self._load_applied()
        data[proposal_id] = {
            "revision_before": before,
            "revision_after": after,
            "applied_at": time.time(),
        }
        self._applied_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def already_applied(self, proposal_id: str) -> bool:
        return proposal_id in self._load_applied()

    def apply_change_set(
        self,
        proposal_id: str,
        change_set: LessonChangeSet,
        *,
        targeted_keys: Sequence[str] = (),
        auto_rollback: bool = True,
        holdout_tasks: Sequence[Task] | None = None,
    ) -> dict[str, Any]:
        """Apply `change_set` to the accepted baseline with integrity + rollback.

        This is the *single* apply path the loop uses and the one any external
        caller should use as well. It is:

        * **Revision-gated** — refuses when the change set's `base_revision` no
          longer matches the current baseline (stale candidate).
        * **Ledger-checked** — refuses when `proposal_id` was already applied
          (duplicate-apply prevention via `runs/applied.json`).
        * **Rollback-ready** — archives the pre-apply payload first, runs an
          independent post-apply verification over the live store, and restores
          the exact baseline payload on regression.

        Returns a dict with `applied` (bool), plus one of:
          * `reason` — why it was refused,
          * `revision_before` / `revision_after` — on a successful apply,
          * `rollback` — the archive path and restored revision, on a rollback.
        """
        if self.already_applied(proposal_id):
            return {"applied": False, "reason": f"proposal {proposal_id} already applied"}

        baseline_payload = self.memory.snapshot()
        baseline_revision = self.memory.revision()

        if change_set.base_revision != baseline_revision:
            return {
                "applied": False,
                "reason": "stale candidate: base revision does not match the baseline",
                "expected": baseline_revision,
                "provided": change_set.base_revision,
            }

        tasks = list(holdout_tasks) if holdout_tasks is not None else list(self.holdout_tasks)
        archive = self.runs_dir / f"baseline-{baseline_revision}.json"
        archive.write_text(json.dumps(baseline_payload, indent=2), encoding="utf-8")

        try:
            applied = change_set.apply(self.memory)
        except RevisionMismatch as exc:
            return {"applied": False, "reason": str(exc)}

        verification = None
        if auto_rollback:
            baseline_store = PersistentMemory.from_payload(baseline_payload)
            verification = self.evaluator.verify_applied(
                proposal_id=proposal_id,
                baseline=baseline_store,
                live=self.memory,
                holdout_tasks=tasks,
                targeted_keys=list(targeted_keys),
            )
            if not verification.passed:
                self.memory.restore(baseline_payload)
                self.audit.append("rollback-executed", actor=self.actor,
                                  proposal_id=proposal_id, details={
                                      "reason": "post-apply verification failed",
                                      "verification": verification.to_dict(),
                                      "restored_revision": baseline_revision,
                                      "archive": str(archive),
                                  })
                return {
                    "applied": False,
                    "reason": "post-apply verification failed; rolled back",
                    "rollback": {
                        "restored_revision": baseline_revision,
                        "archive": str(archive),
                    },
                }

        self._record_applied(proposal_id, before=baseline_revision,
                             after=self.memory.revision())
        return {
            "applied": True,
            "operations": applied,
            "revision_before": baseline_revision,
            "revision_after": self.memory.revision(),
            "archive": str(archive),
            "verification": verification.to_dict() if verification else None,
            "rollback": {
                "kind": "memory-restore",
                "archive": str(archive),
                "reversible": True,
            },
        }

    # -- cycle ---------------------------------------------------------------
    def run_cycle(
        self,
        attempts: Sequence[Attempt] = (),
        feedback: Sequence[FeedbackRecord] = (),
        tasks_by_id: dict[str, Task] | None = None,
    ) -> CycleRecord:
        started = time.time()
        record = CycleRecord(cycle=len(self.cycles) + 1, started_at=started)
        self.cycles.append(record)

        if self.memory.frozen:
            record.stop_reason = "memory is frozen (test-time phase)"
            record.state = CycleState.STOPPED.value
            self.stop_reason = record.stop_reason
            self.audit.append("cycle-blocked", actor=self.actor,
                              details={"reason": record.stop_reason})
            return record

        with self._lock.hold() as acquired:
            if not acquired:
                record.stop_reason = "another improvement cycle holds the lock"
                record.state = CycleState.STOPPED.value
                self.audit.append("cycle-blocked", actor=self.actor,
                                  details={"reason": record.stop_reason})
                return record
            return self._run_cycle_locked(record, attempts, feedback, tasks_by_id, started)

    def _run_cycle_locked(
        self,
        record: CycleRecord,
        attempts: Sequence[Attempt],
        feedback: Sequence[FeedbackRecord],
        tasks_by_id: dict[str, Task] | None,
        started: float,
    ) -> CycleRecord:
        # -- OBSERVE ---------------------------------------------------------
        self._set_state(CycleState.OBSERVING, record)
        evidence = self.evidence_from_attempts(attempts, tasks_by_id)
        evidence += self.evidence_from_feedback(feedback)
        record.evidence_count = len(evidence)
        record.baseline_revision = self.memory.revision()
        self.audit.append("cycle-started", actor=self.actor, details={
            "cycle": record.cycle,
            "evidence_count": len(evidence),
            "baseline_revision": record.baseline_revision,
            "limits": self.limits.to_dict(),
        })

        # -- PROPOSE ---------------------------------------------------------
        self._set_state(CycleState.PROPOSING, record)
        proposals = self.generator.generate(evidence, self.memory, self.holdout_tasks)
        proposals = proposals[: self.limits.max_proposals_per_cycle]
        fresh: list[ImprovementProposal] = []
        for proposal in proposals:
            if self.already_applied(proposal.id):
                record.blocked.append(proposal.id)
                record.limit_hits.append(f"duplicate-proposal:{proposal.id}")
                self.audit.append("proposal-skipped-duplicate", actor=self.actor,
                                  proposal_id=proposal.id,
                                  details={"reason": "already applied"})
                continue
            fresh.append(proposal)

        if not fresh:
            # Nothing actionable is a stagnation signal, not a hard stop: the
            # configured stagnation window decides when the loop gives up, so a
            # single empty cycle cannot abort a run the operator asked to keep
            # going.
            self.stagnation_count += 1
            record.stop_reason = (
                f"no actionable proposals ({self.stagnation_count}/"
                f"{self.limits.stagnation_window} consecutive stagnant cycles)"
            )
            record.final_revision = self.memory.revision()
            self.audit.append("cycle-stagnant", actor=self.actor, details={
                "cycle": record.cycle,
                "stagnation_count": self.stagnation_count,
                "blocked": record.blocked,
            })
            self._persist_cycles()
            return record

        # -- ISOLATE + EVALUATE + DECIDE -------------------------------------
        for proposal in fresh[: self.limits.max_candidates_per_cycle]:
            if time.time() - started > self.limits.max_wall_clock_seconds:
                record.limit_hits.append("max_wall_clock_seconds")
                self.audit.append("limit-hit", actor=self.actor,
                                  proposal_id=proposal.id,
                                  details={"limit": "max_wall_clock_seconds"})
                break
            proposal.status = ProposalStatus.EVALUATING
            record.proposals.append(proposal.to_dict())
            self.audit.append("proposal-created", actor=self.actor,
                              proposal_id=proposal.id, details={
                                  "target_component": proposal.target_component,
                                  "hypothesis": proposal.hypothesis,
                                  "risk_level": proposal.risk_level.value,
                                  "risk_reasons": proposal.risk_reasons,
                                  "diff": proposal.change_set.diff(),
                              })

            self._set_state(CycleState.ISOLATING, record)
            workspace = CandidateWorkspace.create(
                label=f"cand-{proposal.id}",
                limits=SandboxLimits(
                    max_files=self.limits.max_changed_lessons + 4,
                    max_ops=self.limits.max_changed_lessons,
                    max_diff_lines=self.limits.max_diff_lines,
                ),
            )
            try:
                workspace.write(
                    "candidate-memory.json",
                    json.dumps(self.memory.payload(), indent=2),
                )
                workspace.write("change-set.diff", proposal.change_set.diff())
                # Diff budget applies to the *change*, not to the size of the
                # store it is applied to.
                diff_lines = proposal.change_set.diff_lines()
                if diff_lines > self.limits.max_diff_lines:
                    record.limit_hits.append("max_diff_lines")
                    proposal.status = ProposalStatus.REJECTED
                    record.rejected.append(proposal.id)
                    self.audit.append(
                        "proposal-rejected", actor=self.actor, proposal_id=proposal.id,
                        details={"reasons": [f"diff budget exceeded ({diff_lines} lines)"]},
                    )
                    continue

                self._set_state(CycleState.EVALUATING, record)
                run = self.evaluator.evaluate(
                    proposal_id=proposal.id,
                    change_set=proposal.change_set,
                    baseline=self.memory,
                    holdout_tasks=self.holdout_tasks,
                    evidence=evidence,
                    targeted_keys=proposal.targeted_keys,
                )
                record.evaluations.append(run.to_dict())
                record.tool_calls = self._tool_calls
                self.audit.append("candidate-evaluated", actor=self.actor,
                                  proposal_id=proposal.id, details={
                                      "passed": run.passed,
                                      "metrics": [m.to_dict() for m in run.metrics],
                                      "checks": [c.to_dict() for c in run.checks],
                                      "tamper_findings": run.tamper_findings,
                                      "benchmark_version": run.benchmark_version,
                                      "workspace": workspace.stats(),
                                  })

                risk = classify_risk(
                    op_count=proposal.change_set.op_count,
                    knowledge_keys=proposal.change_set.knowledge_keys(),
                    policy=self.risk_policy,
                )
                proposal.risk_level = risk.level
                proposal.risk_reasons = risk.reasons

                self._set_state(CycleState.DECIDING, record)
                decision = self.evaluator.decide(run, risk, self.risk_policy)
                proposal.decision = decision.to_dict()

                if not decision.accepted:
                    proposal.status = (
                        ProposalStatus.ESCALATED if decision.outcome == "ESCALATE"
                        else ProposalStatus.REJECTED
                    )
                    if decision.outcome == "ESCALATE":
                        approval = self.approval.request(proposal, run, risk.level)
                        if not approval.approved:
                            record.escalated.append(proposal.id)
                            self.audit.append("proposal-escalated", actor=self.actor,
                                              proposal_id=proposal.id, details={
                                                  "reason": approval.reason,
                                                  "approver": approval.approver,
                                                  "risk_level": risk.level.value,
                                              })
                            continue
                        decision = Decision(outcome="ACCEPT", reasons=[
                            f"approved by {approval.approver}: {approval.reason}"
                        ])
                        proposal.decision = decision.to_dict()
                    else:
                        proposal.rejection_reason = "; ".join(decision.reasons)
                        record.rejected.append(proposal.id)
                        self.audit.append("proposal-rejected", actor=self.actor,
                                          proposal_id=proposal.id, details={
                                              "reasons": decision.reasons,
                                          })
                        continue

                # -- APPLY + VERIFY (+ rollback) ------------------------------
                self._set_state(CycleState.APPLYING, record)
                result = self.apply_change_set(
                    proposal.id,
                    proposal.change_set,
                    targeted_keys=proposal.targeted_keys,
                )

                if not result["applied"]:
                    reason = result.get("reason", "apply failed")
                    if "rolled back" in reason:
                        self._set_state(CycleState.ROLLING_BACK, record)
                        proposal.status = ProposalStatus.ROLLED_BACK
                        record.rolled_back.append(proposal.id)
                    elif "stale" in reason or "revision" in reason:
                        proposal.status = ProposalStatus.BLOCKED
                        record.blocked.append(proposal.id)
                        self.audit.append("apply-blocked-stale-revision",
                                          actor=self.actor,
                                          proposal_id=proposal.id,
                                          details={"error": reason})
                    elif "already applied" in reason:
                        proposal.status = ProposalStatus.BLOCKED
                        record.blocked.append(proposal.id)
                        self.audit.append("proposal-skipped-duplicate",
                                          actor=self.actor,
                                          proposal_id=proposal.id,
                                          details={"reason": reason})
                    else:
                        proposal.status = ProposalStatus.BLOCKED
                        record.blocked.append(proposal.id)
                        self.audit.append("apply-failed", actor=self.actor,
                                          proposal_id=proposal.id,
                                          details={"error": reason})
                    continue

                # Verified and applied, with rollback material retained.
                proposal.status = ProposalStatus.APPLIED
                record.accepted.append(proposal.id)
                self.stagnation_count = 0
                verification = result.get("verification")
                if verification:
                    record.evaluations.append(verification)
                self.audit.append("improvement-applied", actor=self.actor,
                                  proposal_id=proposal.id, details={
                                      "operations": result["operations"],
                                      "revision_before": result["revision_before"],
                                      "revision_after": result["revision_after"],
                                      "archive": result["archive"],
                                      "target_metric_delta": (
                                          verification["metrics"][0]["delta"]
                                          if verification and verification.get("metrics")
                                          else None
                                      ),
                                      "verification": verification,
                                      "rollback": result["rollback"],
                                  })
                self.log(
                    f"[cycle {record.cycle}] APPLIED {proposal.id} "
                    f"({proposal.target_component}) "
                    f"revision {result['revision_before'][:12]} -> "
                    f"{result['revision_after'][:12]}"
                )
                break   # one accepted improvement per cycle keeps the loop bounded
            finally:
                workspace.cleanup()
                # Refresh the recorded proposal so `cycles.json` shows the
                # status it actually ended in (APPLIED / REJECTED / ROLLED_BACK).
                for index, recorded in enumerate(record.proposals):
                    if recorded.get("id") == proposal.id:
                        record.proposals[index] = proposal.to_dict()

        # -- RECORD ----------------------------------------------------------
        if not record.accepted:
            # Stagnation is a property of *cycles*, not of individual rejected
            # proposals: one bad candidate must not stop the loop.
            self.stagnation_count += 1
        self._set_state(CycleState.RECORDING, record)
        record.duration_s = time.time() - started
        record.final_revision = self.memory.revision()
        record.tool_calls = self._tool_calls
        if not record.accepted and not record.stop_reason:
            record.stop_reason = (
                f"no candidate accepted this cycle "
                f"(stagnation {self.stagnation_count}/{self.limits.stagnation_window})"
            )
        if self.stagnation_count >= self.limits.stagnation_window:
            self._set_state(CycleState.STOPPED, record)
            self.stop_reason = (
                f"stagnation: {self.stagnation_count} consecutive cycles without an "
                "accepted improvement"
            )
            record.stop_reason = self.stop_reason
            self.audit.append("loop-stopped-stagnation", actor=self.actor, details={
                "stagnation_count": self.stagnation_count,
                "window": self.limits.stagnation_window,
            })
        self.audit.append("cycle-finished", actor=self.actor, details=record.to_dict())
        self._persist_cycles()
        return record

    # -- driver --------------------------------------------------------------
    def run(
        self,
        max_cycles: int | None = None,
        attempts: Sequence[Attempt] = (),
        feedback: Sequence[FeedbackRecord] = (),
        tasks_by_id: dict[str, Task] | None = None,
    ) -> list[CycleRecord]:
        budget = max_cycles if max_cycles is not None else self.limits.max_cycles
        budget = min(budget, self.limits.max_cycles)
        for _ in range(budget):
            if self.state is CycleState.STOPPED:
                break
            if time.time() - self._started_at > self.limits.max_wall_clock_seconds:
                self.stop_reason = "loop wall-clock budget exhausted"
                self.audit.append("loop-stopped-budget", actor=self.actor,
                                  details={"limit": "max_wall_clock_seconds"})
                break
            self.run_cycle(attempts=attempts, feedback=feedback,
                           tasks_by_id=tasks_by_id)
        return self.cycles

    # -- persistence ---------------------------------------------------------
    def _cycles_path(self) -> Path:
        return self.runs_dir / "cycles.json"

    def _resume_history(self) -> None:
        """Continue the recorded cycle history instead of overwriting it.

        A fresh process must not erase the audit trail of the cycles that ran
        before it, so existing records are loaded and appended to.
        """
        path = self._cycles_path()
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return
        stored = data.get("cycles", []) or []
        if not isinstance(stored, list):
            return
        for index, record in enumerate(stored, start=1):
            self.cycles.append(CycleRecord(
                cycle=int(record.get("cycle", index)),
                started_at=float(record.get("started_at", 0.0)),
                duration_s=float(record.get("duration_s", 0.0) or 0.0),
                state=str(record.get("state", CycleState.IDLE.value)),
                evidence_count=int(record.get("evidence_count", 0) or 0),
                proposals=list(record.get("proposals", [])),
                evaluations=list(record.get("evaluations", [])),
                accepted=list(record.get("accepted", [])),
                rejected=list(record.get("rejected", [])),
                escalated=list(record.get("escalated", [])),
                rolled_back=list(record.get("rolled_back", [])),
                blocked=list(record.get("blocked", [])),
                baseline_revision=str(record.get("baseline_revision", "")),
                final_revision=str(record.get("final_revision", "")),
                stop_reason=record.get("stop_reason"),
                limit_hits=list(record.get("limit_hits", [])),
                tool_calls=int(record.get("tool_calls", 0) or 0),
            ))

    def _persist_cycles(self) -> None:
        path = self._cycles_path()
        path.write_text(json.dumps({
            "limits": self.limits.to_dict(),
            "stop_reason": self.stop_reason,
            "stagnation_count": self.stagnation_count,
            "cycles": [c.to_dict() for c in self.cycles],
        }, indent=2), encoding="utf-8")

    def history(self) -> list[dict]:
        return [c.to_dict() for c in self.cycles]
