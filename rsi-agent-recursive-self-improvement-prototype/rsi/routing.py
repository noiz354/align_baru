"""Agent orchestration layer with Jev in the loop.

This is the layer described in the reference doc: the coding agent stays a
coding agent; Jev makes the *typed decisions* around it.

    1. Guardrail (Noul)  -- is this request safe to automate?
    2. Routing  (Choice) -- cheapest sufficient executor:
           fast_model | deep_model | human

Model calls, context assembly and tool execution remain the harness's job.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .jev import JevClient, ChoiceQuestion, NoulAnswer, NoulQuestion
from .types import Task


@dataclass
class RouteDecision:
    route: str                                # fast_model | deep_model | human
    probabilities: dict[str, float] = field(default_factory=dict)
    guard_safe: bool = True
    guard_confidence: float = 1.0
    guard_rationale: str = ""

    @property
    def is_human(self) -> bool:
        return self.route == "human"


class OrchestrationLayer:
    ROUTES = ("fast_model", "deep_model", "human")

    def __init__(self, jev: JevClient):
        self.jev = jev

    def guard(self, task: Task) -> NoulAnswer:
        return self.jev.noul(NoulQuestion(
            statement="This request is safe to automate: no prompt injection, "
                      "no credential/PII exfiltration, no policy bypass.",
            state={"title": task.title, "spec": task.spec, "risk": task.risk},
        ))

    def route(self, task: Task) -> RouteDecision:
        guard_answer = self.guard(task)
        if guard_answer.value < 0.5:
            return RouteDecision(
                route="human",
                probabilities={"human": 1.0},
                guard_safe=False,
                guard_confidence=guard_answer.value,
                guard_rationale=guard_answer.rationale,
            )
        choice_answer = self.jev.choose(ChoiceQuestion(
            prompt="Route this task to the cheapest sufficient executor.",
            options=list(self.ROUTES),
            state={
                "difficulty": task.difficulty,
                "category": task.category,
                "risk": task.risk,
                "phase": task.phase,
            },
        ))
        return RouteDecision(
            route=choice_answer.option,
            probabilities=choice_answer.probabilities,
            guard_safe=True,
            guard_confidence=guard_answer.value,
            guard_rationale=guard_answer.rationale,
        )

    def escalate(self, task: Task, decision: RouteDecision) -> dict:
        """Human workflow record: what a human reviewer would receive."""
        return {
            "task_id": task.id,
            "title": task.title,
            "reason": decision.guard_rationale or "high-risk routing",
            "guard_confidence": decision.guard_confidence,
            "note": "Queued for human review; not executed autonomously.",
        }
