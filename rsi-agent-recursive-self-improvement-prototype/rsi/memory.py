"""Persistent memory for RSI.

Memory stores reusable, verifier-approved lessons and procedures. It is the
artifact that makes the improvement *recursive*: later rounds (and later
agents) run with the accumulated experience of earlier ones.

At test time the memory is FROZEN: reads are allowed, writes raise. This
mirrors RSIAgent's design where Curriculum + memory updates are disabled and
the hard-won knowledge is used as-is.

Memory is also the *only* artifact the RSI loop is allowed to mutate. That is
what keeps this prototype bounded: there is no code to rewrite, no permission
to escalate, no deployment to trigger -- just lessons that were observed
against real execution. See MEMORY.md for the write policy.

Revision / rollback
-------------------
`revision()` is a content hash over the canonical JSON payload. Every accepted
improvement records the revision it was based on; applying a change set whose
`base_revision` no longer matches is refused, which prevents a stale candidate
from being applied on top of a newer baseline. `snapshot()` / `restore()` make
the previous accepted state recoverable at any time.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Iterable

from .types import Lesson


class MemoryFrozenError(RuntimeError):
    """Raised when something tries to write to frozen (test-time) memory."""


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str)


def content_revision(payload: dict[str, Any]) -> str:
    """Stable content hash used as a memory revision identifier."""
    digest = hashlib.sha256(canonical_json(payload).encode("utf-8"))
    return f"mem-{digest.hexdigest()[:16]}"


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
        self._lessons = [Lesson.from_dict(item) for item in data.get("lessons", [])]
        self.frozen = bool(data.get("frozen", False)) if restore_frozen else False

    @classmethod
    def from_payload(cls, payload: dict[str, Any],
                     path: str | Path | None = None) -> "PersistentMemory":
        """Rebuild an in-memory store from a payload (used for candidates).

        Accepts serialised lesson dicts or live `Lesson` objects, so
        `snapshot()` output can be handed straight back in.
        """
        memory = cls(path)
        lessons = []
        for item in payload.get("lessons", []):
            lessons.append(item if isinstance(item, Lesson) else Lesson.from_dict(item))
        memory._lessons = lessons
        memory.frozen = bool(payload.get("frozen", False))
        return memory

    def payload(self) -> dict[str, Any]:
        return {
            "frozen": self.frozen,
            "revision": self.revision(),
            "lessons": [lesson.to_dict() for lesson in self._lessons],
        }

    def save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "frozen": self.frozen,
            "lessons": [lesson.to_dict() for lesson in self._lessons],
        }
        self.path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # -- identity ------------------------------------------------------------
    def revision(self) -> str:
        """Content hash of the store -- the baseline revision identifier."""
        return content_revision({
            "lessons": [lesson.to_dict() for lesson in self._lessons],
        })

    def snapshot(self) -> dict[str, Any]:
        """JSON-serialisable deep copy of the current state.

        Used both for candidate isolation and as rollback material, so it must
        survive a round-trip through `json.dumps`/`json.loads` unchanged.
        """
        return {
            "lessons": [lesson.to_dict() for lesson in self._lessons],
            "frozen": self.frozen,
            "revision": self.revision(),
        }

    def restore(self, snapshot: dict[str, Any]) -> None:
        self._lessons = [
            item if isinstance(item, Lesson) else Lesson.from_dict(item)
            for item in snapshot.get("lessons", [])
        ]
        self.frozen = bool(snapshot.get("frozen", False))
        self.save()

    def clone(self, path: str | Path | None = None) -> "PersistentMemory":
        return PersistentMemory.from_payload(self.snapshot(), path)

    # -- writes --------------------------------------------------------------
    def add(self, lesson: Lesson) -> None:
        if self.frozen:
            raise MemoryFrozenError(
                "memory is frozen (test-time phase); lesson writes are disabled"
            )
        self._lessons.append(lesson)
        self.save()

    def replace(self, lesson: Lesson) -> None:
        """Replace an existing lesson in place, bumping its version."""
        if self.frozen:
            raise MemoryFrozenError(
                "memory is frozen (test-time phase); lesson writes are disabled"
            )
        for index, existing in enumerate(self._lessons):
            if existing.id == lesson.id:
                lesson.version = existing.version + 1
                self._lessons[index] = lesson
                self.save()
                return
        raise KeyError(f"no lesson with id {lesson.id!r}")

    def retire(self, lesson_id: str, superseded_by: str | None = None) -> Lesson:
        """Soft-delete a lesson: kept for audit, ignored by reads."""
        if self.frozen:
            raise MemoryFrozenError(
                "memory is frozen (test-time phase); lesson writes are disabled"
            )
        for lesson in self._lessons:
            if lesson.id == lesson_id:
                lesson.deprecated = True
                lesson.superseded_by = superseded_by
                self.save()
                return lesson
        raise KeyError(f"no lesson with id {lesson_id!r}")

    def freeze(self) -> None:
        self.frozen = True
        self.save()

    def unfreeze(self) -> None:
        """Only for tooling/tests -- the RSI loop never unfreezes in a run."""
        self.frozen = False
        self.save()

    # -- reads ---------------------------------------------------------------
    def entries(self) -> list[Lesson]:
        """Every stored lesson, including deprecated ones (audit view)."""
        return list(self._lessons)

    def active(self) -> list[Lesson]:
        """Lessons that still count toward competence (deprecated excluded)."""
        return [lesson for lesson in self._lessons if not lesson.deprecated]

    def keys(self) -> set[str]:
        known: set[str] = set()
        for lesson in self.active():
            known.update(lesson.knowledge_keys)
        return known

    def coverage(self, knowledge_keys: list[str]) -> float:
        """Fraction of the given knowledge keys covered by at least one lesson."""
        if not knowledge_keys:
            return 1.0
        known = self.keys()
        return len(known & set(knowledge_keys)) / len(knowledge_keys)

    def weak_keys(self, candidate_keys: list[str], min_coverage: float = 1.0) -> list[str]:
        """Candidate keys whose coverage is below `min_coverage` (weakest first).

        `min_coverage` is the *required* strength for a key to stop being weak.
        The default `1.0` means "any key with no lesson at all is weak", which is
        what the DRS curriculum targets. A higher threshold additionally flags
        keys covered by fewer than that many lessons, thinnest first.
        """
        wanted = list(dict.fromkeys(candidate_keys))
        if not wanted:
            return []
        threshold = max(1.0, float(min_coverage))
        if threshold <= 1.0:
            known = self.keys()
            return [k for k in wanted if k not in known]
        counts = {k: 0 for k in wanted}
        for lesson in self.active():
            for key in lesson.knowledge_keys:
                if key in counts:
                    counts[key] += 1
        return sorted(
            (k for k in wanted if counts[k] < threshold),
            key=lambda k: (counts[k], k),
        )

    def relevant(self, knowledge_keys: list[str], k: int = 3) -> list[Lesson]:
        """Top-k lessons by shared knowledge keys, then confidence."""
        wanted = set(knowledge_keys)
        ranked = sorted(
            self.active(),
            key=lambda lesson: (
                -len(set(lesson.knowledge_keys) & wanted),
                -lesson.confidence,
                -lesson.created_at,
            ),
        )
        return ranked[:k]

    def stats(self) -> dict:
        active = self.active()
        return {
            "lessons": len(self._lessons),
            "active_lessons": len(active),
            "deprecated_lessons": len(self._lessons) - len(active),
            "frozen": self.frozen,
            "revision": self.revision(),
            "knowledge_keys": sorted(self.keys()),
        }

    def __len__(self) -> int:
        return len(self._lessons)

    def __iter__(self) -> Iterable[Lesson]:
        return iter(self._lessons)
