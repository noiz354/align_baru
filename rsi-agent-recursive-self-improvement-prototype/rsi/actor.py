"""Actor Agent: executes one task inside the ReAct harness.

Given a routing decision, the Actor builds its planner (model tier) and runs
the agentic loop with memory-derived context. It returns the raw SolveResult
-- *no* self-grading; verification is the Verifier's job.
"""
from __future__ import annotations

from typing import Callable

from .harness import ReActHarness
from .memory import PersistentMemory
from .tools import MockToolset
from .types import SolveResult, Task

PlannerFactory = Callable[..., object]
ToolsetFactory = Callable[[Task, object], MockToolset]


def default_mock_toolset_factory(task: Task, planner: object) -> MockToolset:
    """Simulated environment: hidden boundary conditions stay hidden on failure."""
    will_pass = bool(getattr(planner, "outcome", True))
    return MockToolset(will_pass=will_pass, initial_failures=2)


class ActorAgent:
    def __init__(self, actor_id: str, planner_factory: PlannerFactory,
                 harness: ReActHarness | None = None,
                 toolset_factory: ToolsetFactory = default_mock_toolset_factory,
                 seed: int = 0):
        self.actor_id = actor_id
        self.planner_factory = planner_factory
        self.harness = harness or ReActHarness()
        self.toolset_factory = toolset_factory
        self.seed = seed

    def run(self, task: Task, memory: PersistentMemory, route: str) -> SolveResult:
        context_lessons = memory.relevant(task.required_knowledge, k=4)
        planner = self.planner_factory(
            route, task, memory.keys(), seed=self.seed, actor_id=self.actor_id
        )
        toolset = self.toolset_factory(task, planner)
        return self.harness.run(task, planner, toolset, context_lessons)
