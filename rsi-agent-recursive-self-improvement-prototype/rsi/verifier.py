"""Verifier Agent: validates outcomes against real execution and mines lessons.

Every attempted task yields experience -- wins and failures alike:

- success  -> a *procedure* lesson (what worked) with high confidence
- failure  -> a *boundary* lesson (which hidden condition broke) that feeds
  the next DRS round

The verdict itself is delegated to Jev's typed decisions:
    Score  -> attempt quality against a rubric
    Noul   -> "is the task fully done?"
"""
from __future__ import annotations

from .jev import JevClient, NoulQuestion, ScoreQuestion
from .types import Lesson, SolveResult, Task, Verdict, new_id


class VerifierAgent:
    def __init__(self, jev: JevClient):
        self.jev = jev

    def verify(self, task: Task, result: SolveResult) -> Verdict:
        state = {
            "title": task.title,
            "spec": task.spec,
            "checks": result.checks,
            "steps": len(result.steps),
            "output": result.output,
        }
        score_answer = self.jev.score(ScoreQuestion(
            prompt="Grade the quality of this coding attempt.",
            rubric="attempt-quality: correctness via checks (0.65), "
                   "evidence in trace (0.20), concrete output (0.15)",
            state=state,
        ))
        done_answer = self.jev.noul(NoulQuestion(
            statement="The task is fully done: all checks pass and the output is complete.",
            state=state,
        ))
        success = done_answer.value >= 0.5 and score_answer.value >= 0.5
        lessons = self._extract_lessons(task, result, success)
        return Verdict(
            success=success,
            score=score_answer.value,
            done_confidence=done_answer.value,
            lessons=lessons,
        )

    def _extract_lessons(self, task: Task, result: SolveResult,
                         success: bool) -> list[Lesson]:
        if success:
            content = (
                f"[procedure] '{task.title}': applying "
                f"{', '.join(task.required_knowledge)} with "
                f"tests-before-patch then tests-after-patch completed the task."
            )
            keys = list(task.required_knowledge)
            confidence = 0.9
            kind = "procedure"
        else:
            failure_mode = result.failure_mode or "edge-cases"
            content = (
                f"[boundary] '{task.title}': hidden constraint around "
                f"'{failure_mode}' defeated a first-pass fix. Before finalizing "
                f"work in this area, probe {failure_mode} boundary conditions "
                f"explicitly (empty/late/duplicate inputs, concurrency, retries)."
            )
            keys = [failure_mode] + [
                k for k in task.required_knowledge if k != failure_mode
            ][:1]
            confidence = 0.6
            kind = "boundary"
        return [Lesson(
            id=new_id("lesson"),
            content=content,
            knowledge_keys=keys,
            source_task_id=task.id,
            confidence=confidence,
            verified=True,   # observed against actual execution output
            kind=kind,
        )]
