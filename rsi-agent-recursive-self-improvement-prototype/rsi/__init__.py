"""RSI Agent: Recursive Self-Improvement pipeline for coding agents.

Curriculum -> Actor (ReAct) -> Verifier over persistent memory, with Jev
(TypeSafe) as the typed decision model for guardrails, routing, grading and
done-checks. See README.md for the architecture.
"""
from .types import Task, Lesson, Attempt, Verdict, Action, SolveResult
from .memory import PersistentMemory, MemoryFrozenError
from .jev import (
    MockJev,
    TypeSafeJev,
    JevClient,
    ChoiceQuestion,
    ScoreQuestion,
    NoulQuestion,
    ChoiceAnswer,
    ScoreAnswer,
    NoulAnswer,
    get_jev,
)
from .curriculum import CurriculumAgent, KNOWLEDGE_KEYS
from .actor import ActorAgent
from .verifier import VerifierAgent
from .routing import OrchestrationLayer, RouteDecision
from .harness import ReActHarness
from .orchestrator import RSIOrchestrator, summarize
from .planners import mock_planner_factory, openai_planner_factory

__version__ = "0.1.0"

__all__ = [
    "Task", "Lesson", "Attempt", "Verdict", "Action", "SolveResult",
    "PersistentMemory", "MemoryFrozenError",
    "MockJev", "TypeSafeJev", "JevClient",
    "ChoiceQuestion", "ScoreQuestion", "NoulQuestion",
    "ChoiceAnswer", "ScoreAnswer", "NoulAnswer", "get_jev",
    "CurriculumAgent", "KNOWLEDGE_KEYS",
    "ActorAgent", "VerifierAgent", "OrchestrationLayer", "RouteDecision",
    "ReActHarness", "RSIOrchestrator", "summarize",
    "mock_planner_factory", "openai_planner_factory",
]
