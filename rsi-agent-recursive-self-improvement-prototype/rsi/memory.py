"""Persistent memory for RSI.

Memory stores reusable, verifier-approved lessons and procedures. It is the
artifact that makes the improvement *recursive*: later rounds (and later
agents) run with the accumulated experience of earlier ones.

At test time the memory is FROZEN: reads are allowed, writes raise. This
mirrors RSIAgent's design where Curriculum + memory updates are disabled and
the hard-won knowledge is used as-is.
"""
from __future__ import annotations

import json
from pathlib import Path

from .types import Lesson


class MemoryFrozenError(RuntimeError):
    """Raised when something tries to write to frozen (test-time) memory."""


class PersistentMemory:
    def __init__(self, path: str | Path | None = None,
                 restore_frozen: bool = False):
        self.path = Path(path) if path else None
        self._lessons: list[Lesson] = []
        self.frozen = False
        if self.path and self.path.exists():
            # `restore_frozen=False` (default): freezing is a *run lifecycle*
            # event. A new process always starts with writable memory unless it
            # explicitly opts into resuming test-time state.
            self._load(restore_frozen=restore_frozen)

    # -- persistence ---------------------------------------------------------
    def _load(self, restore_frozen: bool = False) -> None:
        data = json.loads(self.path.read_text(encoding="utf-8") or '{"lessons": []}')
        self._lessons = [Lesson(**item) for item in data.get("lessons", [])]
        self.frozen = bool(data.get("frozen", False)) if restore_frozen else False

    def save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "frozen": self.frozen,
            "lessons": [lesson.to_dict() for lesson in self._lessons],
        }
        self.path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # -- writes --------------------------------------------------------------
    def add(self, lesson: Lesson) -> None:
        if self.frozen:
            raise MemoryFrozenError(
                "memory is frozen (test-time phase); lesson writes are disabled"
            )
        self._lessons.append(lesson)
        self.save()

    def freeze(self) -> None:
        self.frozen = True
        self.save()

    def unfreeze(self) -> None:
        """Only for tooling/tests -- the RSI loop never unfreezes in a run."""
        self.frozen = False
        self.save()

    # -- reads ---------------------------------------------------------------
    def keys(self) -> set[str]:
        known: set[str] = set()
        for lesson in self._lessons:
            known.update(lesson.knowledge_keys)
        return known

    def coverage(self, knowledge_keys: list[str]) -> float:
        """Fraction of the given knowledge keys covered by at least one lesson."""
        if not knowledge_keys:
            return 1.0
        known = self.keys()
        return len(known & set(knowledge_keys)) / len(knowledge_keys)

    def weak_keys(self, candidate_keys: list[str], min_coverage: float = 1.0) -> list[str]:
        """Candidate keys whose coverage is below `min_coverage` (weakest first)."""
        known = self.keys()
        missing = [k for k in candidate_keys if k not in known]
        return missing if min_coverage >= 1.0 else missing

    def relevant(self, knowledge_keys: list[str], k: int = 3) -> list[Lesson]:
        """Top-k lessons by shared knowledge keys, then confidence."""
        wanted = set(knowledge_keys)
        ranked = sorted(
            self._lessons,
            key=lambda lesson: (
                -len(set(lesson.knowledge_keys) & wanted),
                -lesson.confidence,
                -lesson.created_at,
            ),
        )
        return ranked[:k]

    def stats(self) -> dict:
        return {
            "lessons": len(self._lessons),
            "frozen": self.frozen,
            "knowledge_keys": sorted(self.keys()),
        }

    def __len__(self) -> int:
        return len(self._lessons)
