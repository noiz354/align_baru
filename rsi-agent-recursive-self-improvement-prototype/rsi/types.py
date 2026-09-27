"""Core datatypes shared across the RSI pipeline.

Naming follows the reference architecture:
- Task / Attempt / Lesson / Verdict for the Curriculum -> Actor -> Verifier loop.
- Action for the ReAct (thought / tool / finish) agentic loop.
"""
from __future__ import annotations

import time
import uuid
import zlib
from dataclasses import asdict, dataclass, field
from typing import Any


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def stable_seed(*parts: object) -> int:
    """Deterministic seed across runs (unlike builtin hash(), which is salted)."""
    return zlib.crc32(":".join(str(p) for p in parts).encode("utf-8"))


@dataclass
class Task:
    id: str
    title: str
    category: str
    difficulty: float            # 0..1
    required_knowledge: list[str]
    spec: str
    phase: str = "BRS"           # BRS | DRS | TEST
    risk: float = 0.0            # 0..1, feeds Jev guardrail/routing

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Lesson:
    """A verified piece of experience stored in persistent memory.

    Memory entries are versioned so a bad learned rule can be deprecated and
    superseded instead of silently rewritten (MEMORY.md §Memory versioning).
    """
    id: str
    content: str
    knowledge_keys: list[str]
    source_task_id: str
    confidence: float            # 0..1
    verified: bool               # True once the Verifier observed it against execution
    created_at: float = field(default_factory=time.time)
    kind: str = "lesson"         # lesson | procedure | boundary
    version: int = 1
    superseded_by: str | None = None   # lesson id that replaced this one
    deprecated: bool = False           # soft-deleted: kept for audit, ignored by reads

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Lesson":
        known = {
            "id", "content", "knowledge_keys", "source_task_id", "confidence",
            "verified", "created_at", "kind", "version", "superseded_by",
            "deprecated",
        }
        return cls(**{k: v for k, v in data.items() if k in known})

    def supersede(self, new_lesson_id: str) -> None:
        self.deprecated = True
        self.superseded_by = new_lesson_id


@dataclass
class Action:
    """One step of a ReAct planner: thought, tool call, or finish."""
    kind: str                    # thought | tool | finish
    content: str = ""
    name: str = ""               # tool name when kind == "tool"
    args: dict[str, Any] = field(default_factory=dict)
    checks: dict[str, bool] = field(default_factory=dict)   # populated on finish
    failure_mode: str | None = None                          # populated on finish


@dataclass
class SolveResult:
    output: str
    steps: list[str]
    checks: dict[str, bool]
    failure_mode: str | None = None


@dataclass
class Verdict:
    success: bool
    score: float                 # Jev Score (0..1)
    done_confidence: float       # Jev Noul (0..1) for "is the task done?"
    lessons: list[Lesson] = field(default_factory=list)


@dataclass
class Attempt:
    task_id: str
    task_title: str
    actor_id: str
    route: str                   # fast_model | deep_model | human
    phase: str
    steps: list[str]
    output: str
    success: bool
    score: float
    done_confidence: float
    failure_mode: str | None = None
    escalated: bool = False
    lessons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
