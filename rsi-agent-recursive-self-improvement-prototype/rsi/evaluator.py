"""Evaluation engine: baseline vs candidate, multi-metric, tamper-aware.

An improvement is accepted only on measurable evidence. `EvaluationEngine`
produces an `EvaluationRun` containing:

1. **Structural checks** -- the change set is well formed, every added lesson is
   verifier-verified and traceable to a real observed attempt, budgets hold.
2. **Tamper / overfitting findings** -- attempts to win by weakening the
   evaluation rather than by improving behaviour (see `TamperDetector`).
3. **Behavioural metrics** -- the *same* holdout tasks run against the baseline
   memory and against the isolated candidate memory, compared metric by metric.

A candidate cannot be accepted because one number went up: every critical
metric is checked, and any critical regression rejects the candidate outright.

Nothing here trusts the proposer. `TamperDetector` re-derives traceability from
the evidence list it is handed, not from a claim on the proposal.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Sequence

from .feedback import Evidence, detect_hazard
from .memory import PersistentMemory
from .patches import FilePatch, LessonChangeSet
from .risk import RiskAssessment
from .sandbox import SandboxLimits
from .types import Attempt, Lesson, Task

HoldoutRunner = Callable[[PersistentMemory, Sequence[Task]], list[Attempt]]

BENCHMARK_VERSION = "holdout-v1"

# The single metric an improvement must move to be worth applying.
#
# Recovery rate on the tasks the *baseline currently fails* is used rather than
# raw holdout success rate because it is the objective that matches what
# self-improvement is for -- fix what is broken -- and it is far less noisy on a
# small holdout than a 1/11 step in overall success rate. Everything else in
# the metric table is a guard rail, not an objective.
TARGET_METRIC = "failed_task_recovery_rate"


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str = ""
    mandatory: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "ok": self.ok,
                "detail": self.detail, "mandatory": self.mandatory}


@dataclass
class MetricResult:
    name: str
    baseline: float
    candidate: float
    higher_is_better: bool = True
    critical: bool = True
    unit: str = ""
    tolerance: float = 0.0

    @property
    def delta(self) -> float:
        return round(self.candidate - self.baseline, 6)

    @property
    def improved(self) -> bool:
        return self.delta > self.tolerance if self.higher_is_better else self.delta < -self.tolerance

    @property
    def regressed(self) -> bool:
        return self.delta < -self.tolerance if self.higher_is_better else self.delta > self.tolerance

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "baseline": self.baseline,
            "candidate": self.candidate,
            "delta": self.delta,
            "higher_is_better": self.higher_is_better,
            "critical": self.critical,
            "unit": self.unit,
            "improved": self.improved,
            "regressed": self.regressed,
        }


@dataclass
class EvaluationLimits:
    """Budgets for a single evaluation (wall clock, holdout size, candidates)."""

    max_wall_clock_seconds: float = 60.0
    max_holdout_tasks: int = 24
    max_lessons_per_candidate: int = 4
    max_diff_lines: int = 200

    def to_dict(self) -> dict[str, Any]:
        return {
            "max_wall_clock_seconds": self.max_wall_clock_seconds,
            "max_holdout_tasks": self.max_holdout_tasks,
            "max_lessons_per_candidate": self.max_lessons_per_candidate,
            "max_diff_lines": self.max_diff_lines,
        }


@dataclass
class EvaluationRun:
    id: str
    proposal_id: str
    benchmark_version: str
    environment: dict[str, Any]
    started_at: float
    duration_s: float
    checks: list[CheckResult] = field(default_factory=list)
    metrics: list[MetricResult] = field(default_factory=list)
    tamper_findings: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    target_metric: str = TARGET_METRIC

    @property
    def passed(self) -> bool:
        mandatory = [c for c in self.checks if c.mandatory]
        return (
            all(c.ok for c in mandatory)
            and not self.tamper_findings
            and self.target is not None
            and self.target.improved
        )

    @property
    def critical_regressions(self) -> list[str]:
        return [m.name for m in self.metrics if m.critical and m.regressed]

    @property
    def target(self) -> MetricResult | None:
        return self.metric(self.target_metric)

    def metric(self, name: str) -> MetricResult | None:
        for metric in self.metrics:
            if metric.name == name:
                return metric
        return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "proposal_id": self.proposal_id,
            "benchmark_version": self.benchmark_version,
            "environment": self.environment,
            "started_at": self.started_at,
            "duration_s": round(self.duration_s, 4),
            "passed": self.passed,
            "critical_regressions": self.critical_regressions,
            "tamper_findings": list(self.tamper_findings),
            "notes": list(self.notes),
            "checks": [c.to_dict() for c in self.checks],
            "metrics": [m.to_dict() for m in self.metrics],
        }


# ---------------------------------------------------------------------------
# Acceptance policy
# ---------------------------------------------------------------------------
@dataclass
class AcceptancePolicy:
    """Explicit accept/reject/escalate rules (EVALUATION.md §Acceptance policy).

    A candidate is accepted only when ALL of the following hold:

    1. every mandatory check passes (structure, tamper scan, benchmark pinning);
    2. the target metric improves by at least `min_target_delta`;
    3. no critical metric regressed (success rate, avg score, escalation rate,
       targeted-key coverage);
    4. the change risk is within the auto-accept ceiling, otherwise it is
       escalated to a human approver.
    """

    min_target_delta: float = 0.10
    min_score_delta: float = 0.0
    max_escalation_regression: float = 0.0
    require_target_improvement: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "min_target_delta": self.min_target_delta,
            "min_score_delta": self.min_score_delta,
            "max_escalation_regression": self.max_escalation_regression,
            "require_target_improvement": self.require_target_improvement,
        }


@dataclass
class Decision:
    outcome: str                # ACCEPT | REJECT | ESCALATE
    reasons: list[str] = field(default_factory=list)

    @property
    def accepted(self) -> bool:
        return self.outcome == "ACCEPT"

    def to_dict(self) -> dict[str, Any]:
        return {"outcome": self.outcome, "reasons": list(self.reasons)}


# ---------------------------------------------------------------------------
# Tamper / overfitting detection
# ---------------------------------------------------------------------------
@dataclass
class TamperDetector:
    """Rejects candidates that try to win by weakening the evaluation.

    Rules (each produces a finding, and any finding blocks acceptance):

    R1  traceability  -- every added lesson must come from a real observed
                         attempt (`source_task_id` present in the evidence).
    R2  verification  -- lessons must be verifier-verified, never self-claimed.
    R3  duplication   -- no lesson may duplicate existing memory content.
    R4  benchmark ID  -- no lesson may name a holdout/benchmark task id or
                         title (hardcoding test inputs / special-casing IDs).
    R5  answer leak   -- no lesson may carry expected-answer phrasing.
    R6  hazard        -- no lesson may contain prompt-injection vocabulary.
    R7  relevance     -- at least one added lesson must cover a key the
                         baseline lacks and the holdout actually requires.
    R8  path scope    -- file patches may only touch self-editable files.
    """

    holdout_tasks: Sequence[Task] = field(default_factory=list)
    evidence: Sequence[Evidence] = field(default_factory=list)

    def _task_fingerprints(self) -> list[str]:
        out: list[str] = []
        for task in self.holdout_tasks:
            out.append(task.id.lower())
            out.append(task.title.lower())
        return out

    def check(self, change_set: LessonChangeSet | None = None,
              file_patch: FilePatch | None = None,
              baseline: PersistentMemory | None = None) -> list[str]:
        findings: list[str] = []
        fingerprints = self._task_fingerprints()
        evidence_ids = {e.task_id for e in self.evidence if e.task_id}
        baseline_contents = {
            " ".join(lesson.content.lower().split()) for lesson in (baseline or PersistentMemory(None)).entries()
        }

        if file_patch is not None:
            findings.extend(self._check_file_patch(file_patch))
            return findings

        if change_set is None:
            return ["no change set supplied"]

        holdout_keys: set[str] = set()
        for task in self.holdout_tasks:
            holdout_keys.update(task.required_knowledge)
        baseline_keys = (baseline or PersistentMemory(None)).keys()

        added_relevant = False
        for change in change_set.changes:
            lesson: Lesson | None = change.lesson
            if change.op == "retire" or lesson is None:
                continue

            # R1 traceability
            if evidence_ids and lesson.source_task_id not in evidence_ids:
                findings.append(
                    f"R1 lesson {lesson.id} claims source task "
                    f"{lesson.source_task_id!r} which is not in the evidence set"
                )
            # R2 verification
            if not lesson.verified:
                findings.append(f"R2 lesson {lesson.id} is not verifier-verified")
            # R3 duplication
            normalized = " ".join(lesson.content.lower().split())
            if normalized in baseline_contents:
                findings.append(f"R3 lesson {lesson.id} duplicates existing memory")
            # R4 benchmark id / title leakage
            lowered = f"{lesson.content} {lesson.id}".lower()
            for fingerprint in fingerprints:
                if fingerprint and fingerprint in lowered:
                    findings.append(
                        f"R4 lesson {lesson.id} references benchmark task "
                        f"{fingerprint!r} (hardcoded test input)"
                    )
            # R5 answer leak
            if any(p in lowered for p in ("expected answer", "expected output",
                                          "golden output", "correct answer")):
                findings.append(f"R5 lesson {lesson.id} carries expected-answer phrasing")
            # R6 hazard
            if hazard := detect_hazard(lesson.content):
                findings.append(f"R6 lesson {lesson.id} contains hazard marker {hazard!r}")
            # R7 relevance
            if set(lesson.knowledge_keys) & holdout_keys:
                if not (set(lesson.knowledge_keys) & baseline_keys):
                    added_relevant = True

        if not added_relevant:
            findings.append(
                "R7 no added lesson covers a knowledge key the baseline lacks "
                "and the holdout requires (improvement would be irrelevant)"
            )
        return findings

    def _check_file_patch(self, patch: FilePatch) -> list[str]:
        findings: list[str] = []
        from .risk import is_self_editable_path

        if not is_self_editable_path(patch.path):
            findings.append(
                f"R8 file patch targets {patch.path!r}, which is not self-editable"
            )
        if hazard := detect_hazard(patch.new_content):
            findings.append(f"R6 file patch contains hazard marker {hazard!r}")
        if any(p in patch.new_content.lower()
               for p in ("expected answer", "golden output", "correct answer")):
            findings.append("R5 file patch carries expected-answer phrasing")
        if patch.diff_lines() > 400:
            findings.append(
                f"R8 file patch diff is {patch.diff_lines()} lines (budget 400)"
            )
        return findings


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
class EvaluationEngine:
    """Runs structural checks, tamper detection and behavioural comparison."""

    def __init__(
        self,
        holdout_runner: HoldoutRunner,
        *,
        limits: EvaluationLimits | None = None,
        policy: AcceptancePolicy | None = None,
        benchmark_version: str = BENCHMARK_VERSION,
        environment: dict[str, Any] | None = None,
    ):
        self.target_metric = TARGET_METRIC
        self.holdout_runner = holdout_runner
        self.limits = limits or EvaluationLimits()
        self.policy = policy or AcceptancePolicy()
        self.benchmark_version = benchmark_version
        self.environment = environment or {"python": _python_tag()}
        self.runs: list[EvaluationRun] = []

    # -- public API ----------------------------------------------------------
    def evaluate(
        self,
        *,
        proposal_id: str,
        change_set: LessonChangeSet | None = None,
        file_patch: FilePatch | None = None,
        baseline: PersistentMemory,
        holdout_tasks: Sequence[Task],
        evidence: Sequence[Evidence] = (),
        targeted_keys: Sequence[str] = (),
    ) -> EvaluationRun:
        started = time.time()
        tasks = list(holdout_tasks)[: self.limits.max_holdout_tasks]
        detector = TamperDetector(holdout_tasks=tasks, evidence=list(evidence))
        findings = detector.check(change_set=change_set, file_patch=file_patch,
                                  baseline=baseline)

        candidate = baseline.clone()
        if change_set is not None:
            problems = change_set.validate(SandboxLimits(
                max_ops=self.limits.max_lessons_per_candidate,
                max_diff_lines=self.limits.max_diff_lines,
            ))
            try:
                change_set.apply(candidate)
            except Exception as exc:                      # noqa: BLE001
                problems.append(f"change set could not be applied: {exc}")
        elif file_patch is not None:
            problems = file_patch.validate(SandboxLimits(
                max_diff_lines=self.limits.max_diff_lines,
            ))
        else:
            problems = ["no change set or file patch supplied"]

        checks = [
            CheckResult("change-set-valid", not problems, "; ".join(problems) or "ok"),
            CheckResult("tamper-scan", not findings, "; ".join(findings) or "ok"),
            CheckResult("benchmark-version-pinned", True, self.benchmark_version),
        ]

        baseline_attempts, candidate_attempts = self._run_both(baseline, candidate, tasks)
        metrics = self._metrics(baseline_attempts, candidate_attempts,
                                baseline, candidate, targeted_keys)

        run = EvaluationRun(
            id=f"eval-{int(started * 1000):x}",
            proposal_id=proposal_id,
            benchmark_version=self.benchmark_version,
            environment=dict(self.environment),
            started_at=started,
            duration_s=time.time() - started,
            checks=checks,
            metrics=metrics,
            tamper_findings=findings,
        )
        self.runs.append(run)
        return run

    def verify_applied(
        self,
        *,
        proposal_id: str,
        baseline: PersistentMemory,
        live: PersistentMemory,
        holdout_tasks: Sequence[Task],
        targeted_keys: Sequence[str] = (),
    ) -> EvaluationRun:
        """Post-apply smoke verification of the *live* store against baseline.

        This is deliberately independent of the candidate evaluation: it does not
        re-apply the change set, it measures the state the system is actually in
        now. If this fails, the caller must roll back (ROLLBACK.md).
        """
        started = time.time()
        tasks = list(holdout_tasks)[: self.limits.max_holdout_tasks]
        baseline_attempts, live_attempts = self._run_both(baseline, live, tasks)
        metrics = self._metrics(baseline_attempts, live_attempts,
                                baseline, live, targeted_keys)
        target = next((m for m in metrics if m.name == self.target_metric), None)
        ok = target is not None and target.improved and not any(
            m.critical and m.regressed for m in metrics
        )
        detail = (
            f"target {target.name} delta {target.delta:+.3f}"
            if target else "target metric missing"
        )
        run = EvaluationRun(
            id=f"verify-{int(started * 1000):x}",
            proposal_id=proposal_id,
            benchmark_version=self.benchmark_version,
            environment=dict(self.environment),
            started_at=started,
            duration_s=time.time() - started,
            checks=[CheckResult("post-apply-verification", ok, detail)],
            metrics=metrics,
        )
        self.runs.append(run)
        return run

    def _run_both(
        self, baseline: PersistentMemory, candidate: PersistentMemory, tasks: Sequence[Task]
    ) -> tuple[list[Attempt], list[Attempt]]:
        return (
            list(self.holdout_runner(baseline, tasks)),
            list(self.holdout_runner(candidate, tasks)),
        )

    def decide(self, run: EvaluationRun, risk: RiskAssessment | None = None,
               risk_policy: Any = None) -> Decision:
        """Apply the acceptance policy to a finished evaluation run."""
        reasons: list[str] = []

        for check in run.checks:
            if check.mandatory and not check.ok:
                reasons.append(f"check failed: {check.name} ({check.detail})")
        if run.tamper_findings:
            reasons.append("tamper findings: " + "; ".join(run.tamper_findings))

        target = run.target
        if target is None:
            reasons.append(f"target metric {run.target_metric!r} missing")
        elif self.policy.require_target_improvement and not target.improved:
            reasons.append(
                f"target metric {target.name} did not improve "
                f"(delta {target.delta:+.3f})"
            )
        elif target.delta < self.policy.min_target_delta - 1e-9:
            reasons.append(
                f"target metric {target.name} improved by {target.delta:+.3f}, "
                f"below the {self.policy.min_target_delta:+.3f} threshold"
            )

        score = run.metric("holdout_avg_score")
        if score is not None and score.delta < self.policy.min_score_delta - 1e-9:
            reasons.append(f"avg score regressed ({score.delta:+.3f})")

        escalation = run.metric("holdout_escalation_rate")
        if (escalation is not None
                and escalation.delta > self.policy.max_escalation_regression + 1e-9):
            reasons.append(
                f"human escalation rate rose ({escalation.delta:+.3f}); "
                "the candidate makes the system less autonomous"
            )

        if run.critical_regressions:
            reasons.append(
                "critical regression(s): " + ", ".join(run.critical_regressions)
            )

        if reasons:
            return Decision(outcome="REJECT", reasons=reasons)

        if risk is not None:
            needs_approval = (
                risk_policy.requires_human_approval(risk.level)
                if risk_policy is not None else risk.requires_human_approval
            )
            if needs_approval:
                return Decision(
                    outcome="ESCALATE",
                    reasons=[
                        f"risk level {risk.level.value} requires human approval: "
                        + "; ".join(risk.reasons)
                    ],
                )
        return Decision(outcome="ACCEPT", reasons=[
            f"target metric {target.name if target else '?'} improved by "
            f"{target.delta if target else 0:+.3f} with no critical regression"
        ])

    # -- metric computation --------------------------------------------------
    def _metrics(
        self,
        baseline_attempts: Sequence[Attempt],
        candidate_attempts: Sequence[Attempt],
        baseline: PersistentMemory,
        candidate: PersistentMemory,
        targeted_keys: Sequence[str],
    ) -> list[MetricResult]:
        def rate(attempts: Sequence[Attempt], predicate) -> float:
            if not attempts:
                return 0.0
            return sum(1 for a in attempts if predicate(a)) / len(attempts)

        b_exec = [a for a in baseline_attempts if not a.escalated]
        c_exec = [a for a in candidate_attempts if not a.escalated]
        b_success = rate(b_exec, lambda a: a.success)
        c_success = rate(c_exec, lambda a: a.success)
        b_score = (sum(a.score for a in b_exec) / len(b_exec)) if b_exec else 0.0
        c_score = (sum(a.score for a in c_exec) / len(c_exec)) if c_exec else 0.0
        b_esc = rate(baseline_attempts, lambda a: a.escalated)
        c_esc = rate(candidate_attempts, lambda a: a.escalated)

        keys = list(dict.fromkeys(targeted_keys)) or list(candidate.keys())
        b_cov = baseline.coverage(keys) if keys else 1.0
        c_cov = candidate.coverage(keys) if keys else 1.0

        # Recovery on the tasks the baseline actually fails: the objective.
        b_failed = [a for a in baseline_attempts if not a.escalated and not a.success]
        c_by_task = {a.task_id: a for a in candidate_attempts}
        rescued = sum(
            1 for a in b_failed
            if (c := c_by_task.get(a.task_id)) is not None
            and not c.escalated and c.success
        )
        b_recovery = 0.0
        c_recovery = (rescued / len(b_failed)) if b_failed else 0.0

        return [
            MetricResult("failed_task_recovery_rate", round(b_recovery, 4),
                         round(c_recovery, 4),
                         higher_is_better=True, critical=True, unit="ratio"),
            MetricResult("holdout_success_rate", round(b_success, 4), round(c_success, 4),
                         higher_is_better=True, critical=True, unit="ratio"),
            MetricResult("holdout_avg_score", round(b_score, 4), round(c_score, 4),
                         higher_is_better=True, critical=True, tolerance=0.01,
                         unit="score"),
            MetricResult("holdout_escalation_rate", round(b_esc, 4), round(c_esc, 4),
                         higher_is_better=False, critical=True, unit="ratio"),
            MetricResult("targeted_key_coverage", round(b_cov, 4), round(c_cov, 4),
                         higher_is_better=True, critical=True, unit="ratio"),
            MetricResult("memory_lessons", float(len(baseline.active())),
                         float(len(candidate.active())),
                         higher_is_better=False, critical=False, unit="count"),
        ]


def _python_tag() -> str:
    import platform

    return platform.python_version()


def render_run(run: EvaluationRun) -> str:
    """Markdown rendering used by the report and the dashboard."""
    lines = [
        f"### Evaluation `{run.id}` — proposal `{run.proposal_id}`",
        "",
        f"- benchmark: `{run.benchmark_version}` · duration {run.duration_s:.3f}s",
        f"- outcome: **{'PASS' if run.passed else 'FAIL'}**",
        "",
        "| Metric | Baseline | Candidate | Delta | Critical |",
        "|---|---|---|---|---|",
    ]
    for metric in run.metrics:
        lines.append(
            f"| {metric.name} | {metric.baseline:.3f} | {metric.candidate:.3f} "
            f"| {metric.delta:+.3f} | {'yes' if metric.critical else 'no'} |"
        )
    if run.tamper_findings:
        lines += ["", "Tamper findings:"]
        lines += [f"- {finding}" for finding in run.tamper_findings]
    for check in run.checks:
        if not check.ok:
            lines.append(f"- failed check `{check.name}`: {check.detail}")
    return "\n".join(lines)
