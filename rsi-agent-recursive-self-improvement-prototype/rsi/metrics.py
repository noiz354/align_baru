"""Loop-health metrics (OBSERVABILITY.md).

Answers the questions an operator must be able to ask about *the improvement
process itself*, not just about the agent:

    How many cycles ran?  How many proposals were generated?
    How many were accepted / rejected / escalated / rolled back / blocked?
    What is the acceptance rate, the regression rate, the rollback rate?
    How long does an evaluation take?
    How big was the median improvement delta?
    How many candidate-generation failures were there?
    Is the loop stagnating?
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

from .evaluator import TARGET_METRIC, EvaluationRun


def _median(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return (float(ordered[mid - 1]) + float(ordered[mid])) / 2.0


@dataclass
class LoopHealth:
    cycles: int = 0
    proposals: int = 0
    accepted: int = 0
    rejected: int = 0
    escalated: int = 0
    rolled_back: int = 0
    blocked: int = 0
    candidate_generation_failures: int = 0
    evaluations: int = 0
    evaluation_failures: int = 0
    tamper_findings: int = 0
    stagnation_count: int = 0
    total_duration_s: float = 0.0
    mean_evaluation_duration_s: float = 0.0
    median_improvement_delta: float = 0.0
    median_improvement_metric: str = ""
    limit_hits: dict[str, int] = field(default_factory=dict)
    audit_event_counts: dict[str, int] = field(default_factory=dict)

    @property
    def acceptance_rate(self) -> float:
        decided = self.accepted + self.rejected
        return (self.accepted / decided) if decided else 0.0

    @property
    def rejection_rate(self) -> float:
        decided = self.accepted + self.rejected
        return (self.rejected / decided) if decided else 0.0

    @property
    def escalation_rate(self) -> float:
        return (self.escalated / self.proposals) if self.proposals else 0.0

    @property
    def rollback_rate(self) -> float:
        applied = self.accepted + self.rolled_back
        return (self.rolled_back / applied) if applied else 0.0

    @property
    def regression_rate(self) -> float:
        evaluated = self.accepted + self.rejected + self.rolled_back
        return (self.rejected / evaluated) if evaluated else 0.0

    @property
    def candidate_failure_rate(self) -> float:
        return (self.evaluation_failures / self.evaluations) if self.evaluations else 0.0

    @property
    def stagnant(self) -> bool:
        return self.stagnation_count > 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "cycles": self.cycles,
            "proposals": self.proposals,
            "accepted": self.accepted,
            "rejected": self.rejected,
            "escalated": self.escalated,
            "rolled_back": self.rolled_back,
            "blocked": self.blocked,
            "acceptance_rate": round(self.acceptance_rate, 4),
            "rejection_rate": round(self.rejection_rate, 4),
            "escalation_rate": round(self.escalation_rate, 4),
            "rollback_rate": round(self.rollback_rate, 4),
            "regression_rate": round(self.regression_rate, 4),
            "candidate_failure_rate": round(self.candidate_failure_rate, 4),
            "candidate_generation_failures": self.candidate_generation_failures,
            "evaluations": self.evaluations,
            "evaluation_failures": self.evaluation_failures,
            "tamper_findings": self.tamper_findings,
            "stagnation_count": self.stagnation_count,
            "stagnant": self.stagnant,
            "total_duration_s": round(self.total_duration_s, 4),
            "mean_evaluation_duration_s": round(self.mean_evaluation_duration_s, 4),
            "median_improvement_delta": round(self.median_improvement_delta, 4),
            "median_improvement_metric": self.median_improvement_metric,
            "limit_hits": dict(self.limit_hits),
            "audit_event_counts": dict(self.audit_event_counts),
        }


def compute_loop_health(
    cycles: Iterable[Any],
    *,
    audit_counts: dict[str, int] | None = None,
    target_metric: str = TARGET_METRIC,
) -> LoopHealth:
    """Aggregate cycle records into loop-health metrics."""
    health = LoopHealth()
    deltas: list[float] = []
    durations: list[float] = []

    for cycle in cycles:
        health.cycles += 1
        health.proposals += len(getattr(cycle, "proposals", []))
        health.accepted += len(getattr(cycle, "accepted", []))
        health.rejected += len(getattr(cycle, "rejected", []))
        health.escalated += len(getattr(cycle, "escalated", []))
        health.rolled_back += len(getattr(cycle, "rolled_back", []))
        health.blocked += len(getattr(cycle, "blocked", []))
        health.total_duration_s += float(getattr(cycle, "duration_s", 0.0) or 0.0)
        for hit in getattr(cycle, "limit_hits", []) or []:
            key = hit.split(":", 1)[0]
            health.limit_hits[key] = health.limit_hits.get(key, 0) + 1
            if key == "duplicate-proposal":
                health.candidate_generation_failures += 1

        for evaluation in getattr(cycle, "evaluations", []) or []:
            health.evaluations += 1
            duration = float(evaluation.get("duration_s", 0.0) or 0.0)
            durations.append(duration)
            if not evaluation.get("passed", False):
                health.evaluation_failures += 1
            health.tamper_findings += len(evaluation.get("tamper_findings", []) or [])
            for metric in evaluation.get("metrics", []) or []:
                if metric.get("name") == target_metric and metric.get("delta") is not None:
                    deltas.append(float(metric["delta"]))

    if audit_counts:
        health.audit_event_counts = dict(audit_counts)

    health.mean_evaluation_duration_s = (
        sum(durations) / len(durations) if durations else 0.0
    )
    health.median_improvement_delta = _median(deltas)
    health.median_improvement_metric = target_metric
    return health


def render_health(health: LoopHealth) -> str:
    lines = [
        "## Loop health",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Cycles | {health.cycles} |",
        f"| Proposals | {health.proposals} |",
        f"| Accepted | {health.accepted} |",
        f"| Rejected | {health.rejected} |",
        f"| Escalated (awaiting human) | {health.escalated} |",
        f"| Rolled back | {health.rolled_back} |",
        f"| Blocked | {health.blocked} |",
        f"| Acceptance rate | {health.acceptance_rate * 100:.0f}% |",
        f"| Regression rate | {health.regression_rate * 100:.0f}% |",
        f"| Rollback rate | {health.rollback_rate * 100:.0f}% |",
        f"| Candidate failure rate | {health.candidate_failure_rate * 100:.0f}% |",
        f"| Mean evaluation duration | {health.mean_evaluation_duration_s:.3f}s |",
        f"| Median improvement delta ({health.median_improvement_metric}) "
        f"| {health.median_improvement_delta:+.3f} |",
        f"| Stagnation count | {health.stagnation_count} |",
        "",
    ]
    if health.limit_hits:
        lines.append("Limit hits: " + ", ".join(
            f"{k}={v}" for k, v in sorted(health.limit_hits.items())
        ))
        lines.append("")
    return "\n".join(lines)
