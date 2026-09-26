"""Jev integration layer.

Jev (TypeSafe AI) is a *System One* decision model: it does not generate text
or code. It answers typed questions over a state and returns structured
answers:

    Choice  -> one option from a list, with per-option probabilities
    Score   -> a number against a caller-defined rubric
    Noul    -> 0..1 confidence for a true/false statement

Inside this pipeline Jev is used at four decision points (see README):
    1. Guardrail  (Noul):  "is this request safe to automate?"
    2. Routing    (Choice): fast_model / deep_model / human
    3. Grading    (Score):  attempt quality against a rubric
    4. Done-check (Noul):   "is the task fully done?"

Two clients ship here:
    MockJev     -- deterministic, offline heuristics (used by demo + tests)
    TypeSafeJev -- adapter sketch for the real TypeSafe API (needs an API key)
"""
from __future__ import annotations

import json
import math
import os
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Protocol


# ---------------------------------------------------------------------------
# Typed questions / answers
# ---------------------------------------------------------------------------
@dataclass
class ChoiceQuestion:
    prompt: str
    options: list[str]
    state: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChoiceAnswer:
    option: str
    probabilities: dict[str, float]


@dataclass
class ScoreQuestion:
    prompt: str
    rubric: str
    state: dict[str, Any] = field(default_factory=dict)
    min_value: float = 0.0
    max_value: float = 1.0


@dataclass
class ScoreAnswer:
    value: float
    rationale: str = ""


@dataclass
class NoulQuestion:
    statement: str
    state: dict[str, Any] = field(default_factory=dict)


@dataclass
class NoulAnswer:
    value: float                 # 0..1 confidence that the statement is true
    rationale: str = ""


class JevClient(Protocol):
    def choose(self, question: ChoiceQuestion) -> ChoiceAnswer: ...
    def score(self, question: ScoreQuestion) -> ScoreAnswer: ...
    def noul(self, question: NoulQuestion) -> NoulAnswer: ...


# ---------------------------------------------------------------------------
# MockJev -- offline, deterministic stand-in
# ---------------------------------------------------------------------------
_INJECTION_MARKERS = (
    "ignore previous",
    "ignore all previous",
    "system prompt",
    "reveal the prompt",
    "print the system",
    "exfiltrat",
    "jailbreak",
    "bypass",
    "reveal credential",
    "api key",
    "password",
    "credential",
)


def _softmax(scores: dict[str, float], gain: float = 2.2) -> dict[str, float]:
    exps = {k: math.exp(gain * v) for k, v in scores.items()}
    total = sum(exps.values())
    return {k: round(v / total, 3) for k, v in exps.items()}


class MockJev:
    """Deterministic heuristic judge with the same typed surface as real Jev.

    Every answer is a pure function of `question.state`, so runs are
    reproducible and tests are stable. Swap in TypeSafeJev for real semantics.
    """

    name = "mock-jev"

    def choose(self, question: ChoiceQuestion) -> ChoiceAnswer:
        state = question.state
        difficulty = float(state.get("difficulty", 0.5))
        risk = float(state.get("risk", 0.0))
        scores = {
            "fast_model": 1.0 - difficulty,
            "deep_model": 0.25 + difficulty,
            "human": 0.15 + 1.6 * risk,
        }
        scores = {opt: scores.get(opt, 0.0) for opt in question.options}
        probabilities = _softmax(scores)
        option = max(probabilities, key=probabilities.get)
        return ChoiceAnswer(option=option, probabilities=probabilities)

    def score(self, question: ScoreQuestion) -> ScoreAnswer:
        state = question.state
        checks: dict[str, bool] = state.get("checks", {}) or {}
        ratio = (sum(1 for v in checks.values() if v) / len(checks)) if checks else 0.0
        steps = int(state.get("steps", 0))
        output = (state.get("output") or "").strip()
        value = (
            0.65 * ratio
            + 0.20 * (1.0 if steps >= 3 else 0.4)
            + 0.15 * (1.0 if len(output) > 20 else 0.2)
        )
        value = max(question.min_value, min(question.max_value, value))
        return ScoreAnswer(
            value=round(value, 3),
            rationale=f"checks={ratio:.2f}, steps={steps}, output_len={len(output)}",
        )

    def noul(self, question: NoulQuestion) -> NoulAnswer:
        state = question.state
        statement = question.statement.lower()
        text = f"{state.get('title', '')} {state.get('spec', '')}".lower()

        # Guardrail: "safe to automate" statements.
        if "safe" in statement:
            marker_hit = next((m for m in _INJECTION_MARKERS if m in text), None)
            risk = float(state.get("risk", 0.0))
            if marker_hit:
                return NoulAnswer(
                    value=0.08,
                    rationale=f"hazard marker detected: {marker_hit!r}",
                )
            return NoulAnswer(
                value=round(max(0.05, 0.92 - 0.5 * risk), 3),
                rationale=f"no hazard markers; risk={risk:.2f}",
            )

        # Done-check: "task is fully done" statements.
        checks: dict[str, bool] = state.get("checks", {}) or {}
        if not checks:
            return NoulAnswer(value=0.12, rationale="no checks reported")
        passed = sum(1 for v in checks.values() if v)
        output_complete = len((state.get("output") or "").strip()) > 20
        if passed == len(checks) and output_complete:
            return NoulAnswer(value=0.92, rationale="all checks pass, output complete")
        if passed >= len(checks) / 2:
            return NoulAnswer(value=0.4, rationale=f"{passed}/{len(checks)} checks pass")
        return NoulAnswer(value=0.12, rationale=f"only {passed}/{len(checks)} checks pass")


# ---------------------------------------------------------------------------
# TypeSafeJev -- adapter sketch for the real Jev API
# ---------------------------------------------------------------------------
class TypeSafeJev:
    """Thin HTTP adapter for TypeSafe's Jev (System One) API.

    The request/response shape below is *illustrative* -- adapt it to TypeSafe's
    published API before production use. Requires `TYPESAFE_API_KEY`
    (and optionally `TYPESAFE_API_URL`).
    """

    name = "typesafe-jev"

    def __init__(self, api_key: str | None = None, base_url: str | None = None,
                 timeout: float = 30.0):
        self.api_key = api_key or os.environ.get("TYPESAFE_API_KEY")
        self.base_url = (
            base_url
            or os.environ.get("TYPESAFE_API_URL")
            or "https://api.typesafe.ai/v1"
        )
        self.timeout = timeout
        if not self.api_key:
            raise RuntimeError(
                "TypeSafeJev needs TYPESAFE_API_KEY (or an explicit api_key). "
                "Use MockJev for offline runs."
            )

    def _ask(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            f"{self.base_url}/decide",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def choose(self, question: ChoiceQuestion) -> ChoiceAnswer:
        data = self._ask({
            "type": "choice",
            "prompt": question.prompt,
            "options": question.options,
            "state": question.state,
        })
        return ChoiceAnswer(option=data["option"], probabilities=data["probabilities"])

    def score(self, question: ScoreQuestion) -> ScoreAnswer:
        data = self._ask({
            "type": "score",
            "prompt": question.prompt,
            "rubric": question.rubric,
            "state": question.state,
            "min": question.min_value,
            "max": question.max_value,
        })
        return ScoreAnswer(value=float(data["value"]),
                           rationale=data.get("rationale", ""))

    def noul(self, question: NoulQuestion) -> NoulAnswer:
        data = self._ask({
            "type": "noul",
            "statement": question.statement,
            "state": question.state,
        })
        return NoulAnswer(value=float(data["value"]),
                          rationale=data.get("rationale", ""))


def get_jev(prefer: str = "mock") -> JevClient:
    """Factory: 'mock' (default, offline) or 'typesafe' (needs API key)."""
    if prefer == "typesafe":
        return TypeSafeJev()
    return MockJev()
