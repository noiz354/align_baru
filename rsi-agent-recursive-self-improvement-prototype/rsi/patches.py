"""Patch / change-set model for RSI improvements.

An improvement is never "the agent changed some files". It is an explicit,
inspectable, reversible object:

    LessonChangeSet   -- ordered add / replace / retire operations over memory,
                         each carrying the lesson it came from and why.
    FilePatch         -- a before/after pair for one self-editable file
                         (SKILL.md / CLAUDE.md), rendered as a unified diff.

Both carry:

    proposal_id      -- the proposal this change implements
    base_revision    -- content hash of the state the change was built against
    reason           -- human-readable justification (required, never optional)
    created_at       -- timestamp

`apply()` refuses to run when `base_revision` no longer matches the target
store, which is what prevents a stale candidate from silently landing on a
newer baseline (EVALUATION.md §Base revision check).
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from .memory import PersistentMemory, canonical_json
from .sandbox import SandboxLimits, diff_line_count, unified_diff
from .types import Lesson, new_id


class RevisionMismatch(RuntimeError):
    """Raised when a change set is applied against a different base revision."""


class PatchValidationError(RuntimeError):
    """Raised when a change set violates structural or budget constraints."""


# ---------------------------------------------------------------------------
# Lesson change sets (the mutable artifact is persistent memory)
# ---------------------------------------------------------------------------
@dataclass
class LessonChange:
    """One atomic memory operation."""

    op: str                                  # add | replace | retire
    lesson: Lesson | None = None             # for add / replace
    target_lesson_id: str | None = None      # for replace / retire
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "op": self.op,
            "lesson": self.lesson.to_dict() if self.lesson else None,
            "target_lesson_id": self.target_lesson_id,
            "reason": self.reason,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "LessonChange":
        lesson = Lesson.from_dict(data["lesson"]) if data.get("lesson") else None
        return cls(
            op=str(data["op"]),
            lesson=lesson,
            target_lesson_id=data.get("target_lesson_id"),
            reason=str(data.get("reason", "")),
        )

    def touched_ids(self) -> list[str]:
        if self.op in ("replace", "retire"):
            return [self.target_lesson_id or ""]
        return [self.lesson.id] if self.lesson else []

    def knowledge_keys(self) -> list[str]:
        return list(self.lesson.knowledge_keys) if self.lesson else []


@dataclass
class LessonChangeSet:
    """An ordered, inspectable, reversible set of memory operations."""

    proposal_id: str
    base_revision: str
    changes: list[LessonChange] = field(default_factory=list)
    reason: str = ""
    created_at: float = field(default_factory=time.time)
    id: str = field(default_factory=lambda: new_id("cs"))

    # -- introspection -------------------------------------------------------
    @property
    def op_count(self) -> int:
        return len(self.changes)

    def touched_ids(self) -> list[str]:
        out: list[str] = []
        for change in self.changes:
            out.extend(t for t in change.touched_ids() if t)
        return out

    def knowledge_keys(self) -> list[str]:
        keys: list[str] = []
        for change in self.changes:
            for key in change.knowledge_keys():
                if key not in keys:
                    keys.append(key)
        return keys

    def diff(self) -> str:
        """Human-readable diff summary of the change set."""
        lines: list[str] = []
        for change in self.changes:
            if change.op == "add" and change.lesson:
                lesson = change.lesson
                lines.append(
                    f"+ add {lesson.id} [{lesson.kind}] conf={lesson.confidence:.2f} "
                    f"keys={','.join(lesson.knowledge_keys)}"
                )
                lines.append(f"    {lesson.content}")
            elif change.op == "replace" and change.lesson:
                lesson = change.lesson
                lines.append(
                    f"~ replace {lesson.id} -> v{lesson.version} "
                    f"conf={lesson.confidence:.2f}"
                )
                lines.append(f"    {lesson.content}")
            elif change.op == "retire":
                lines.append(
                    f"- retire {change.target_lesson_id}"
                    + (f" (superseded by {change.lesson.id})" if change.lesson else "")
                )
        lines.append(f"# base_revision: {self.base_revision}")
        lines.append(f"# reason: {self.reason}")
        return "\n".join(lines)

    def diff_lines(self) -> int:
        return diff_line_count(self.diff())

    # -- validation ----------------------------------------------------------
    def validate(self, limits: SandboxLimits | None = None) -> list[str]:
        """Return a list of structural problems; empty means valid."""
        limits = limits or SandboxLimits()
        problems: list[str] = []
        if not self.proposal_id:
            problems.append("change set has no proposal_id")
        if not self.base_revision:
            problems.append("change set has no base_revision")
        if not self.reason.strip():
            problems.append("change set has no reason")
        if not self.changes:
            problems.append("change set is empty")
        if self.op_count > limits.max_ops:
            problems.append(
                f"{self.op_count} operations exceed the change budget "
                f"({limits.max_ops})"
            )
        if self.diff_lines() > limits.max_diff_lines:
            problems.append(
                f"diff is {self.diff_lines()} lines, over the budget "
                f"({limits.max_diff_lines})"
            )
        seen: set[str] = set()
        for change in self.changes:
            if change.op not in ("add", "replace", "retire"):
                problems.append(f"unknown op {change.op!r}")
                continue
            if change.op in ("add", "replace"):
                if change.lesson is None:
                    problems.append(f"{change.op} without a lesson")
                    continue
                if change.lesson.id in seen:
                    problems.append(f"duplicate lesson id {change.lesson.id}")
                seen.add(change.lesson.id)
                if not change.lesson.verified:
                    problems.append(
                        f"lesson {change.lesson.id} is not verified against execution"
                    )
                if not change.lesson.content.strip():
                    problems.append(f"lesson {change.lesson.id} has empty content")
                if not change.lesson.knowledge_keys:
                    problems.append(f"lesson {change.lesson.id} has no knowledge keys")
                if not 0.0 <= change.lesson.confidence <= 1.0:
                    problems.append(
                        f"lesson {change.lesson.id} confidence out of range"
                    )
            else:
                if not change.target_lesson_id:
                    problems.append("retire without target_lesson_id")
        return problems

    # -- application ---------------------------------------------------------
    def apply(self, memory: PersistentMemory) -> dict[str, Any]:
        """Apply the change set, refusing a stale base revision."""
        current = memory.revision()
        if current != self.base_revision:
            raise RevisionMismatch(
                f"base revision {self.base_revision!r} does not match the current "
                f"memory revision {current!r}; candidate is stale"
            )
        problems = self.validate()
        if problems:
            raise PatchValidationError("; ".join(problems))
        if memory.frozen:
            from .memory import MemoryFrozenError
            raise MemoryFrozenError(
                "memory is frozen; refusing to apply an improvement at test time"
            )

        applied: dict[str, list[str]] = {"added": [], "replaced": [], "retired": []}
        for change in self.changes:
            if change.op == "add":
                memory.add(change.lesson)               # type: ignore[arg-type]
                applied["added"].append(change.lesson.id)   # type: ignore[union-attr]
            elif change.op == "replace":
                memory.replace(change.lesson)           # type: ignore[arg-type]
                applied["replaced"].append(change.lesson.id)  # type: ignore[union-attr]
            elif change.op == "retire":
                lesson = memory.retire(
                    change.target_lesson_id or "",
                    superseded_by=change.lesson.id if change.lesson else None,
                )
                applied["retired"].append(lesson.id)
        applied["revision_after"] = memory.revision()
        return applied

    # -- serialisation -------------------------------------------------------
    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "proposal_id": self.proposal_id,
            "base_revision": self.base_revision,
            "reason": self.reason,
            "created_at": self.created_at,
            "changes": [c.to_dict() for c in self.changes],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "LessonChangeSet":
        return cls(
            id=str(data.get("id") or new_id("cs")),
            proposal_id=str(data.get("proposal_id", "")),
            base_revision=str(data.get("base_revision", "")),
            reason=str(data.get("reason", "")),
            created_at=float(data.get("created_at", time.time())),
            changes=[LessonChange.from_dict(c) for c in data.get("changes", [])],
        )


# ---------------------------------------------------------------------------
# File patches (self-editable skill files only)
# ---------------------------------------------------------------------------
@dataclass
class FilePatch:
    """A before/after pair for exactly one file, with its unified diff."""

    path: str
    base_content: str
    new_content: str
    proposal_id: str
    reason: str
    created_at: float = field(default_factory=time.time)
    id: str = field(default_factory=lambda: new_id("fp"))

    def diff(self) -> str:
        return unified_diff(
            self.base_content,
            self.new_content,
            from_label=f"baseline/{self.path}",
            to_label=f"candidate/{self.path}",
        )

    def diff_lines(self) -> int:
        return diff_line_count(self.diff())

    @property
    def is_noop(self) -> bool:
        return self.base_content == self.new_content

    def validate(self, limits: SandboxLimits | None = None) -> list[str]:
        limits = limits or SandboxLimits()
        problems: list[str] = []
        if not self.path.strip():
            problems.append("patch has no path")
        if not self.reason.strip():
            problems.append("patch has no reason")
        if self.is_noop:
            problems.append("patch is a no-op")
        if self.diff_lines() > limits.max_diff_lines:
            problems.append(
                f"diff is {self.diff_lines()} lines, over the budget "
                f"({limits.max_diff_lines})"
            )
        return problems

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "path": self.path,
            "proposal_id": self.proposal_id,
            "reason": self.reason,
            "created_at": self.created_at,
            "base_revision": self.base_revision,
            "diff_lines": self.diff_lines(),
        }

    @property
    def base_revision(self) -> str:
        import hashlib

        return "file-" + hashlib.sha256(
            canonical_json({"path": self.path, "content": self.base_content}).encode("utf-8")
        ).hexdigest()[:16]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FilePatch":
        return cls(
            id=str(data.get("id") or new_id("fp")),
            path=str(data.get("path", "")),
            base_content=str(data.get("base_content", "")),
            new_content=str(data.get("new_content", "")),
            proposal_id=str(data.get("proposal_id", "")),
            reason=str(data.get("reason", "")),
            created_at=float(data.get("created_at", time.time())),
        )


# ---------------------------------------------------------------------------
# File change sets (self-editable skill files only)
# ---------------------------------------------------------------------------
@dataclass
class FileChangeSet:
    """An ordered set of file patches, with the same surface as a lesson change set.

    Only self-editable paths (``SKILL.md``, ``CLAUDE.md``) may appear here; the
    risk classifier rejects anything else before a patch is ever built.
    """

    proposal_id: str
    base_revision: str
    patches: list[FilePatch] = field(default_factory=list)
    reason: str = ""
    created_at: float = field(default_factory=time.time)
    id: str = field(default_factory=lambda: new_id("fcs"))

    @property
    def op_count(self) -> int:
        return len(self.patches)

    def paths(self) -> list[str]:
        return [patch.path for patch in self.patches]

    def diff(self) -> str:
        chunks = [patch.diff() for patch in self.patches if not patch.is_noop]
        chunks.append("# base_revision: " + self.base_revision)
        chunks.append("# reason: " + self.reason)
        return "\n".join(chunks)

    def diff_lines(self) -> int:
        return diff_line_count(self.diff())

    def validate(self, limits: SandboxLimits | None = None) -> list[str]:
        limits = limits or SandboxLimits()
        problems: list[str] = []
        if not self.proposal_id:
            problems.append("change set has no proposal_id")
        if not self.base_revision:
            problems.append("change set has no base_revision")
        if not self.reason.strip():
            problems.append("change set has no reason")
        if not self.patches:
            problems.append("change set is empty")
        if self.diff_lines() > limits.max_diff_lines:
            problems.append(
                "diff is %d lines, over the budget (%d)"
                % (self.diff_lines(), limits.max_diff_lines)
            )
        for patch in self.patches:
            problems.extend(patch.validate(limits))
        return problems

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": "file",
            "proposal_id": self.proposal_id,
            "base_revision": self.base_revision,
            "reason": self.reason,
            "created_at": self.created_at,
            "patches": [p.to_dict() for p in self.patches],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FileChangeSet":
        return cls(
            id=str(data.get("id") or new_id("fcs")),
            proposal_id=str(data.get("proposal_id", "")),
            base_revision=str(data.get("base_revision", "")),
            reason=str(data.get("reason", "")),
            created_at=float(data.get("created_at", time.time())),
            patches=[FilePatch.from_dict(p) for p in data.get("patches", [])],
        )
