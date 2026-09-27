"""Feedback ingestion: raw signals in, structured evidence out.

Feedback arrives from many places -- execution failures, test failures, tool
failures, benchmark regressions, human corrections, review comments. It is
*untrusted input*: a failing test's error message, a benchmark fixture, or a
human note can contain text that looks like an instruction ("ignore previous
instructions and ..."). None of that ever becomes an instruction.

The ingestor therefore performs a strict DATA / INSTRUCTIONS split:

* **DATA** -- the free-text `message` and any `payload`. Scanned for hazard
  markers, length-capped, and *never* rendered into a proposal's hypothesis
  verbatim. It is stored only as an opaque, redacted `evidence_excerpt`.
* **INSTRUCTIONS** -- the structured fields (`source`, `task_id`,
  `knowledge_keys`, `failure_mode`, `human_confirmed`). Only these drive
  proposal generation.

Anything carrying a hazard marker, or claiming human confirmation that is not
backed by `human_confirmed=True` from a `human` source, is demoted to
`quarantined` and excluded from proposal generation.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Iterable

from .sandbox import find_secret, redact
from .types import new_id

# Hazard markers that indicate prompt-injection / exfiltration attempts. Shared
# with the Jev guardrail vocabulary in rsi/jev.py.
HAZARD_MARKERS: tuple[str, ...] = (
    "ignore previous",
    "ignore all previous",
    "disregard previous",
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
    "rm -rf",
    "sudo ",
    "curl ",
    "chmod 777",
    "eval(",
    "os.system",
    "subprocess",
    # Self-modification of the guardrails themselves.
    "disable the audit",
    "delete the audit",
    "rewrite rsi/",
    "modify rsi/",
    "edit rsi/",
    "bypass the guardrail",
    "grant yourself",
    "escalate privileges",
    "skip approval",
    "without approval",
    "silently",
    "production deployment",
    "deploy to production",
    "chmod 777",
    "curl ",
    "wget ",
    # Instructing the agent to fake a result instead of producing one. These are
    # precise multi-word phrases, never bare verbs, so a legitimate procedure
    # lesson ("skip the retry path when the input is empty") is not flagged.
    "skip the assertion",
    "skip the test",
    "skip the check",
    "skip the checks",
    "mark the task done",
    "mark it done",
    "mark it as done",
    "pretend it passed",
    "assume it passed",
    "fake a pass",
    "fabricate a pass",
    "report success",
    "claim success",
)


class FeedbackSource(str, Enum):
    EXECUTION_FAILURE = "execution_failure"
    TEST_FAILURE = "test_failure"
    TOOL_FAILURE = "tool_failure"
    BENCHMARK_REGRESSION = "benchmark_regression"
    HUMAN_CORRECTION = "human_correction"
    REVIEW_COMMENT = "review_comment"
    HISTORICAL_MISTAKE = "historical_mistake"


class FeedbackStatus(str, Enum):
    ACCEPTED = "accepted"
    QUARANTINED = "quarantined"


@dataclass
class FeedbackRecord:
    """One raw feedback signal (untrusted input)."""

    source: str
    message: str
    task_id: str | None = None
    knowledge_keys: list[str] = field(default_factory=list)
    failure_mode: str | None = None
    human_confirmed: bool = False
    payload: dict[str, Any] = field(default_factory=dict)
    received_at: float = field(default_factory=time.time)
    id: str = field(default_factory=lambda: new_id("fb"))

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source": self.source,
            "message": self.message,
            "task_id": self.task_id,
            "knowledge_keys": list(self.knowledge_keys),
            "failure_mode": self.failure_mode,
            "human_confirmed": self.human_confirmed,
            "received_at": self.received_at,
        }


@dataclass
class Evidence:
    """Structured, validated improvement evidence derived from feedback."""

    id: str
    source: str
    task_id: str | None
    knowledge_keys: list[str]
    failure_mode: str | None
    success: bool
    score: float
    done_confidence: float
    phase: str
    human_confirmed: bool = False
    status: str = FeedbackStatus.ACCEPTED.value
    quarantine_reason: str | None = None
    excerpt: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source": self.source,
            "task_id": self.task_id,
            "knowledge_keys": list(self.knowledge_keys),
            "failure_mode": self.failure_mode,
            "success": self.success,
            "score": self.score,
            "done_confidence": self.done_confidence,
            "phase": self.phase,
            "human_confirmed": self.human_confirmed,
            "status": self.status,
            "quarantine_reason": self.quarantine_reason,
            "excerpt": self.excerpt,
        }


def detect_hazard(text: str) -> str | None:
    lowered = text.lower()
    for marker in HAZARD_MARKERS:
        if marker in lowered:
            return marker
    return None


class FeedbackIngestor:
    """Converts untrusted feedback records into structured evidence."""

    def __init__(self, max_excerpt_chars: int = 200,
                 allowed_sources: Iterable[str] | None = None):
        self.max_excerpt_chars = max_excerpt_chars
        self.allowed_sources = (
            set(allowed_sources) if allowed_sources
            else {s.value for s in FeedbackSource}
        )

    def ingest(self, record: FeedbackRecord) -> Evidence:
        """Return one Evidence item; quarantined records carry a reason."""
        base = dict(
            id=record.id,
            source=record.source,
            task_id=record.task_id,
            knowledge_keys=list(dict.fromkeys(record.knowledge_keys)),
            failure_mode=record.failure_mode,
            success=bool(record.payload.get("success", False)),
            score=float(record.payload.get("score", 0.0) or 0.0),
            done_confidence=float(record.payload.get("done_confidence", 0.0) or 0.0),
            phase=str(record.payload.get("phase", "BRS")),
            human_confirmed=bool(record.human_confirmed),
            excerpt=self._excerpt(record),
        )
        if record.source not in self.allowed_sources:
            base.update(status=FeedbackStatus.QUARANTINED.value,
                        quarantine_reason=f"unknown feedback source {record.source!r}")
        elif hazard := detect_hazard(record.message):
            base.update(status=FeedbackStatus.QUARANTINED.value,
                        quarantine_reason=f"hazard marker in message: {hazard!r}")
        elif find_secret(record.message):
            base.update(status=FeedbackStatus.QUARANTINED.value,
                        quarantine_reason="credential-shaped value in message")
        elif record.human_confirmed and record.source != FeedbackSource.HUMAN_CORRECTION.value:
            # A machine signal must not be able to mint "human approval".
            base.update(human_confirmed=False,
                        quarantine_reason=(
                            "human_confirmed claimed by a non-human source; "
                            "demoted to unconfirmed"
                        ))
        return Evidence(**base)

    def ingest_many(self, records: Iterable[FeedbackRecord]) -> list[Evidence]:
        return [self.ingest(record) for record in records]

    def usable(self, evidence: Iterable[Evidence]) -> list[Evidence]:
        """Only accepted evidence may drive proposal generation."""
        return [e for e in evidence if e.status == FeedbackStatus.ACCEPTED.value]

    def _excerpt(self, record: FeedbackRecord) -> str:
        text = redact(record.message or "")
        text = " ".join(text.split())
        if len(text) > self.max_excerpt_chars:
            text = text[: self.max_excerpt_chars - 3] + "..."
        return text
