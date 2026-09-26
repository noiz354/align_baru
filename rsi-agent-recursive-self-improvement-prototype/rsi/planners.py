"""Planners: the "brain" behind each ReAct step.

A Planner answers one question per turn: given the task + memory + transcript
so far, what is the next Action (thought / tool call / finish)?

- MockPlanner:            deterministic offline simulation (demo + tests).
- OpenAICompatPlanner:    real LLM via any OpenAI-compatible chat endpoint
  (OpenAI, vLLM, Ollama, OpenRouter, ...). Set OPENAI_API_KEY and optionally
  OPENAI_BASE_URL / OPENAI_MODEL.

Route -> model tier mapping lives here as factory helpers, so the
OrchestrationLayer only decides *the route string*; it never touches models.
"""
from __future__ import annotations

import json
import os
import random
import urllib.request
from typing import Any, Protocol

from .types import Action, Task, stable_seed


class Planner(Protocol):
    name: str

    def next_action(self, ctx: dict[str, Any]) -> Action: ...
    def final_checks(self) -> dict[str, bool]: ...
    def failure_mode(self) -> str | None: ...


def _clamp(value: float, low: float = 0.05, high: float = 0.95) -> float:
    return max(low, min(high, value))


class MockPlanner:
    """Simulated coding agent with a controllable skill level.

    Success probability is a function of model skill, memory coverage of the
    task's required knowledge keys, and task difficulty -- so *memory visibly
    changes outcomes*, which is the whole point of the RSI demo:

        p = 0.20 + 0.55 * coverage + 0.22 * skill - 0.32 * difficulty

    The ReAct trace it emits is scripted but realistic: run tests -> patch ->
    re-run -> finish, with the final test run reflecting the simulated outcome.
    """

    def __init__(self, task: Task, skill: float, covered_keys: set[str],
                 seed: int = 0, name: str = "mock-model"):
        self.name = name
        self.task = task
        self.skill = skill
        self.covered_keys = covered_keys
        keys = task.required_knowledge
        self.coverage = (
            len(set(keys) & covered_keys) / len(keys) if keys else 1.0
        )
        self.outcome = self._simulate(seed)
        self._failure_mode = None if self.outcome else self._pick_failure_mode()
        self._checks = self._build_checks()
        self._script = self._build_script()
        self._index = 0

    # -- simulation ---------------------------------------------------------
    def _simulate(self, seed: int) -> bool:
        p = _clamp(
            0.20
            + 0.55 * self.coverage
            + 0.22 * self.skill
            - 0.32 * self.task.difficulty
        )
        rng = random.Random(stable_seed(seed, self.task.id, self.name))
        return rng.random() < p

    def _pick_failure_mode(self) -> str:
        """The weakest required knowledge key becomes the observed failure mode."""
        weakest = min(
            self.task.required_knowledge,
            key=lambda k: (k in self.covered_keys, k),
        )
        return weakest or "edge-cases"

    def _build_checks(self) -> dict[str, bool]:
        if self.outcome:
            return {"unit_tests": True, "acceptance": True, "constraints": True}
        return {"unit_tests": False, "acceptance": False, "constraints": True}

    def _build_script(self) -> list[Action]:
        task = self.task
        recalled = len(self.covered_keys & set(task.required_knowledge))
        actions = [
            Action("thought",
                   content=f"Plan for '{task.title}': inspect repo state "
                           f"({recalled} relevant lesson(s) recalled)."),
            Action("tool", name="grep", args={"pattern": task.category}),
            Action("tool", name="run_tests"),
            Action("tool", name="read_file", args={"path": "src/module.py"}),
        ]
        if self.outcome:
            actions += [
                Action("thought",
                       content=f"Root cause is in {{{', '.join(task.required_knowledge[:2])}}}; "
                               f"apply known procedure and patch."),
                Action("tool", name="write_file",
                       args={"path": "src/module.py",
                             "content": f"fix({task.id}): applied verified procedure"}),
                Action("tool", name="run_tests"),
                Action("finish",
                       content=f"Implemented: {task.title}. All checks green.",
                       checks=dict(self._checks), failure_mode=None),
            ]
        else:
            actions += [
                Action("thought",
                       content=f"First patch attempt around '{self._failure_mode}'..."),
                Action("tool", name="write_file",
                       args={"path": "src/module.py",
                             "content": f"attempt({task.id}): partial fix"}),
                Action("tool", name="run_tests"),
                Action("finish",
                       content=f"Partial: '{task.title}' still fails at hidden boundary "
                               f"'{self._failure_mode}'. Needs focused exploration.",
                       checks=dict(self._checks), failure_mode=self._failure_mode),
            ]
        return actions

    # -- Planner protocol ----------------------------------------------------
    def next_action(self, ctx: dict[str, Any]) -> Action:
        if self._index < len(self._script):
            action = self._script[self._index]
            self._index += 1
            return action
        return Action("finish", content="(script exhausted)",
                      checks=dict(self._checks), failure_mode=self._failure_mode)

    def final_checks(self) -> dict[str, bool]:
        return dict(self._checks)

    def failure_mode(self) -> str | None:
        return self._failure_mode


class OpenAICompatPlanner:
    """Real-LLM planner over any OpenAI-compatible /chat/completions endpoint.

    The model is asked to emit ONE JSON action per turn:
        {"kind": "thought"|"tool"|"finish", "content": "...",
         "tool": "...", "args": {...}, "checks": {...}, "failure_mode": "..."}
    """

    def __init__(self, task: Task, covered_keys: set[str], seed: int = 0,
                 name: str | None = None, model: str | None = None,
                 api_key: str | None = None, base_url: str | None = None,
                 temperature: float = 0.2):
        self.task = task
        self.covered_keys = covered_keys
        self.model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self.name = name or f"openai:{self.model}"
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.base_url = (base_url or os.environ.get("OPENAI_BASE_URL")
                         or "https://api.openai.com/v1").rstrip("/")
        self.temperature = temperature
        self._checks: dict[str, bool] = {}
        self._failure_mode: str | None = None
        if not self.api_key:
            raise RuntimeError("OpenAICompatPlanner needs OPENAI_API_KEY")

    def next_action(self, ctx: dict[str, Any]) -> Action:
        prompt = self._render_prompt(ctx)
        raw = self._chat(prompt)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return Action("finish", content=raw[:400], checks=self._checks)
        kind = data.get("kind", "finish")
        action = Action(
            kind=kind,
            content=str(data.get("content", "")),
            name=str(data.get("tool", "")),
            args=dict(data.get("args", {}) or {}),
        )
        if kind == "finish":
            self._checks = {str(k): bool(v) for k, v in (data.get("checks") or {}).items()}
            self._failure_mode = data.get("failure_mode")
            action.checks = dict(self._checks)
            action.failure_mode = self._failure_mode
        return action

    def final_checks(self) -> dict[str, bool]:
        return dict(self._checks)

    def failure_mode(self) -> str | None:
        return self._failure_mode

    # -- plumbing -----------------------------------------------------------
    def _render_prompt(self, ctx: dict[str, Any]) -> str:
        return (
            "You are the Actor in a ReAct coding loop. Reply with ONE JSON object "
            "for the next action only.\n\n"
            f"TASK:\n{json.dumps(self.task.to_dict(), indent=2)}\n\n"
            f"MEMORY LESSONS:\n{json.dumps(ctx.get('memory', []), indent=2)}\n\n"
            f"TRANSCRIPT SO FAR:\n{json.dumps(ctx.get('transcript', []), indent=2)}\n\n"
            'JSON schema: {"kind": "thought"|"tool"|"finish", "content": str, '
            '"tool": "run_tests"|"read_file"|"write_file"|"grep", "args": {}, '
            '"checks": {"unit_tests": bool, ...}, "failure_mode": str|null}'
        )

    def _chat(self, prompt: str) -> str:
        payload = {
            "model": self.model,
            "temperature": self.temperature,
            "messages": [
                {"role": "system",
                 "content": "You are a careful software engineering agent."},
                {"role": "user", "content": prompt},
            ],
        }
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Route -> planner factories
# ---------------------------------------------------------------------------
# Model tiers for the mock: fast = cheap/quick model, deep = frontier model.
MOCK_SKILL_BY_ROUTE = {"fast_model": 0.35, "deep_model": 0.75}


def mock_planner_factory(route: str, task: Task, covered_keys: set[str],
                         seed: int = 0, actor_id: str = "actor-0") -> Planner:
    skill = MOCK_SKILL_BY_ROUTE.get(route, 0.5)
    return MockPlanner(task=task, skill=skill, covered_keys=covered_keys,
                       seed=seed, name=f"{route}:{actor_id}")


def openai_planner_factory(fast_model: str = "gpt-4o-mini",
                           deep_model: str = "gpt-4o") -> Any:
    def factory(route: str, task: Task, covered_keys: set[str],
                seed: int = 0, actor_id: str = "actor-0") -> Planner:
        model = deep_model if route == "deep_model" else fast_model
        return OpenAICompatPlanner(task=task, covered_keys=covered_keys,
                                   model=model, name=f"{route}:{actor_id}")
    return factory
