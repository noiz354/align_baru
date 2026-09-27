"""ReAct agentic loop (the harness).

    Context -> Planner(LLM) -> Tool Call -> Observation -> Memory Update -> ...

repeats until the planner emits `finish` or the step budget runs out. The
context at every step is rebuilt from: the task spec, relevant memory lessons,
and the running transcript -- matching the standard coding-agent architecture.
"""
from __future__ import annotations

from typing import Any

from .planners import Planner
from .tools import MockToolset
from .types import Lesson, SolveResult, Task


class ReActHarness:
    def __init__(self, max_steps: int = 12):
        self.max_steps = max_steps

    def run(self, task: Task, planner: Planner, toolset: MockToolset,
            memory_lessons: list[Lesson]) -> SolveResult:
        transcript: list[str] = []
        steps: list[str] = []
        memory_snippets = [lesson.content for lesson in memory_lessons]

        for step_no in range(1, self.max_steps + 1):
            ctx: dict[str, Any] = {
                "task": task.to_dict(),
                "memory": memory_snippets,
                "transcript": transcript,
                "step": step_no,
            }
            action = planner.next_action(ctx)

            if action.kind == "thought":
                line = f"thought: {action.content}"
                steps.append(line)
                transcript.append(line)

            elif action.kind == "tool":
                result = toolset.call(action.name, action.args)
                line = f"tool: {action.name}({action.args}) -> {result.observation}"
                steps.append(line)
                transcript.append(line)

            elif action.kind == "finish":
                line = f"finish: {action.content}"
                steps.append(line)
                return SolveResult(
                    output=action.content,
                    steps=steps,
                    checks=action.checks or planner.final_checks(),
                    failure_mode=action.failure_mode or planner.failure_mode(),
                )

            else:
                steps.append(f"error: unknown action kind {action.kind!r}")

        # A planner that never finished has not proven any acceptance checks.
        # Fail closed: do not let a true cached planner check publish a lesson.
        return SolveResult(
            output="(step budget exhausted)",
            steps=steps,
            checks={"step_budget": False},
            failure_mode="step-budget",
        )
