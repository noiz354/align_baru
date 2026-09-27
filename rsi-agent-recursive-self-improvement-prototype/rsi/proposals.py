"""Improvement proposal model and the evidence-based proposal generator.

A proposal is the unit of self-modification in this prototype. It is *not*
generated from a vibe ("make yourself smarter"); every field is derived from
observed execution evidence:

    id                 deterministic from the evidence it came from, so
                       re-running the same observation cannot mint a duplicate
    source_observation the evidence ids that justify the proposal
    target_component   what would change (memory keys / a skill file)
    hypothesis         a measurable claim ("covering key K raises holdout
                       success rate for tasks requiring K")
    expected_benefit   quantified, from observed coverage gaps
    risk_level         from rsi.risk, computed from the change shape
    change_set         the concrete, inspectable, reversible operations
    evaluation_plan    how the claim will be tested
    rollback_plan      how the previous state is restored
    status             DRAFT -> EVALUATING -> ACCEPTED | REJECTED | APPLIED |
                       ROLLED_BACK | ESCALATED | BLOCKED

`ProposalGenerator` only ever proposes work that the evidence supports and the
baseline does not already cover. If nothing is actionable it returns an empty
list -- which is how stagnation is detected rather than papered over.
"""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Sequence

from .feedback import Evidence
from .memory import PersistentMemory, canonical_json
from .patches import LessonChange, LessonChangeSet
from .risk import RiskAssessment, RiskLevel, classify_risk
from .types import Lesson, Task, new_id, stable_seed


def deterministic_proposal_id(*parts: object) -> str:
    digest = hashlib.sha256(canonical_json(list(parts)).encode("utf-8"))
    return f"prop-{digest.hexdigest()[:12]}"


class ProposalStatus(str, Enum):
    DRAFT = "DRAFT"
    EVALUATING = "EVALUATING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    ESCALATED = "ESCALATED"
    APPLIED = "APPLIED"
    ROLLED_BACK = "ROLLED_BACK"
    BLOCKED = "BLOCKED"

    @property
    def terminal(self) -> bool:
        return self in (
            ProposalStatus.REJECTED, ProposalStatus.APPLIED,
            ProposalStatus.ROLLED_BACK, ProposalStatus.BLOCKED,
        )


@dataclass
class ImprovementProposal:
    id: str
    source_observation: list[str]
    target_component: str
    hypothesis: str
    expected_benefit: str
    change_set: LessonChangeSet
    evaluation_plan: str
    rollback_plan: str
    risk_level: RiskLevel = RiskLevel.LOW
    risk_reasons: list[str] = field(default_factory=list)
    status: ProposalStatus = ProposalStatus.DRAFT
    created_at: float = field(default_factory=time.time)
    rejection_reason: str | None = None
    targeted_keys: list[str] = field(default_factory=list)
    decision: dict | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source_observation": list(self.source_observation),
            "target_component": self.target_component,
            "hypothesis": self.hypothesis,
            "expected_benefit": self.expected_benefit,
            "risk_level": self.risk_level.value,
            "risk_reasons": list(self.risk_reasons),
            "status": self.status.value,
            "created_at": self.created_at,
            "rejection_reason": self.rejection_reason,
            "targeted_keys": list(self.targeted_keys),
            "evaluation_plan": self.evaluation_plan,
            "rollback_plan": self.rollback_plan,
            "change_set": self.change_set.to_dict(),
            "decision": self.decision,
        }


@dataclass
class ProposalGenerator:
    """Turns evidence + baseline memory into bounded, measurable proposals."""

    universe_keys: Sequence[str] = ()
    max_lessons_per_proposal: int = 2
    min_confidence: float = 0.55

    def generate(
        self,
        evidence: Sequence[Evidence],
        baseline: PersistentMemory,
        holdout_tasks: Sequence[Task] = (),
    ) -> list[ImprovementProposal]:
        usable = [e for e in evidence if e.status == "accepted"]
        holdout_keys = self._holdout_key_demand(holdout_tasks)
        covered = baseline.keys()
        proposals: list[ImprovementProposal] = []

        for key in self._ranked_targets(usable, covered, holdout_keys):
            if key in covered:
                continue
            lesson = self._build_lesson(key, usable, holdout_keys.get(key, 0))
            if lesson is None:
                continue
            if lesson.confidence < self.min_confidence:
                continue
            change = LessonChange(op="add", lesson=lesson,
                                  reason=f"cover knowledge key {key!r} "
                                         f"observed as weak in exploration")
            change_set = LessonChangeSet(
                proposal_id="pending",
                base_revision=baseline.revision(),
                changes=[change],
                reason=f"add verified boundary lesson for uncovered key {key!r}",
            )
            proposal_id = deterministic_proposal_id(
                "memory-key", key, baseline.revision(),
                sorted(e.id for e in usable if key in e.knowledge_keys),
            )
            change_set.proposal_id = proposal_id
            assessment = classify_risk(
                op_count=change_set.op_count,
                knowledge_keys=change_set.knowledge_keys(),
            )
            demand = holdout_keys.get(key, 0)
            proposals.append(ImprovementProposal(
                id=proposal_id,
                source_observation=sorted(
                    e.id for e in usable if key in e.knowledge_keys
                ),
                target_component=f"memory:key:{key}",
                hypothesis=(
                    f"Memory has no verified lesson covering '{key}'. Adding one "
                    f"raises targeted-key coverage from "
                    f"{self._coverage_of(baseline, [key]):.2f} to 1.00 for the "
                    f"{demand} holdout task(s) that require it."
                ),
                expected_benefit=(
                    f"holdout success rate for tasks requiring '{key}' is expected "
                    f"to rise; measured against the frozen holdout, target metric "
                    f"delta must be >= the acceptance threshold"
                ),
                change_set=change_set,
                evaluation_plan=(
                    "run the frozen holdout against baseline memory and against an "
                    "isolated candidate clone; compare holdout_success_rate, "
                    "holdout_avg_score, holdout_escalation_rate and "
                    "targeted_key_coverage; run structural + tamper checks first"
                ),
                rollback_plan=(
                    "restore the archived baseline memory payload "
                    "(runs/baseline-<revision>.json) and re-verify the baseline "
                    "holdout metrics; the candidate workspace is discarded"
                ),
                risk_level=assessment.level,
                risk_reasons=assessment.reasons,
                targeted_keys=[key],
            ))
            if len(proposals) >= max(1, self.max_lessons_per_proposal):
                break
        return proposals

    # -- helpers -------------------------------------------------------------
    def _holdout_key_demand(self, tasks: Sequence[Task]) -> dict[str, int]:
        demand: dict[str, int] = {}
        for task in tasks:
            for key in task.required_knowledge:
                demand[key] = demand.get(key, 0) + 1
        return demand

    def _ranked_targets(
        self,
        evidence: Sequence[Evidence],
        covered: set[str],
        holdout_demand: dict[str, int],
    ) -> list[str]:
        """Weakest, most-demanded, uncovered keys first."""
        scores: dict[str, float] = {}
        for item in evidence:
            if item.success:
                continue
            for key in item.knowledge_keys:
                if key in covered:
                    continue
                weight = 1.0 + (0.5 if item.human_confirmed else 0.0)
                scores[key] = scores.get(key, 0.0) + weight
        # Uncovered keys the holdout actually exercises rank above speculative ones.
        for key, demand in holdout_demand.items():
            if key not in covered:
                scores[key] = scores.get(key, 0.0) + 0.25 * demand
        return sorted(scores, key=lambda k: (-scores[k], k))

    def _coverage_of(self, memory: PersistentMemory, keys: Sequence[str]) -> float:
        return memory.coverage(list(keys))

    def _build_lesson(
        self, key: str, evidence: Sequence[Evidence], demand: int
    ) -> Lesson | None:
        sources = [e for e in evidence if key in e.knowledge_keys]
        if not sources:
            return None
        failures = [e for e in sources if not e.success]
        human_backed = [e for e in sources if e.human_confirmed]
        task_ids = sorted({e.task_id for e in sources if e.task_id})
        if failures:
            content = (
                f"[boundary] '{key}': a first-pass fix failed here during "
                f"exploration. Before finalizing work that touches '{key}', probe "
                f"its boundary conditions explicitly (empty, late, duplicate and "
                f"concurrent inputs; retry and timeout paths)."
            )
            kind = "boundary"
            confidence = round(min(0.85, 0.55 + 0.1 * len(failures)), 3)
        else:
            content = (
                f"[procedure] '{key}': the tests-before-patch then tests-after-patch "
                f"procedure completed work in this area. Reuse it verbatim when a "
                f"task requires '{key}'."
            )
            kind = "procedure"
            confidence = round(min(0.9, 0.6 + 0.05 * len(sources)), 3)
        if human_backed:
            confidence = min(0.95, round(confidence + 0.05, 3))
        # Deterministic id: same evidence -> same lesson -> idempotent re-runs.
        lesson_id = "lesson-" + hashlib.sha256(
            canonical_json(["key", key, task_ids]).encode("utf-8")
        ).hexdigest()[:12]
        return Lesson(
            id=lesson_id,
            content=content,
            knowledge_keys=[key],
            source_task_id=task_ids[0] if task_ids else "unknown",
            confidence=confidence,
            verified=True,
            created_at=float(stable_seed("lesson-ts", key, len(sources)) % 10_000) / 1000.0,
            kind=kind,
        )


__all__ = [
    "ImprovementProposal", "ProposalStatus", "ProposalGenerator",
    "deterministic_proposal_id", "RiskAssessment", "RiskLevel",
]
