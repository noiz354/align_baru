"""Append-only, tamper-evident audit log.

Every decision the improvement loop takes -- proposal created, candidate
evaluated, accepted, rejected, applied, rolled back, escalated, limit hit --
is appended here. The log is hash-chained: each record carries the digest of
the previous one, so deleting or rewriting an entry breaks the chain and
`verify_chain()` reports exactly where.

Nothing that looks like a credential is ever written: `AuditLog.append()`
redacts before persisting (SECURITY.md §Secret safety).
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from .memory import canonical_json
from .sandbox import assert_no_secrets, redact


@dataclass
class AuditEvent:
    id: str
    ts: float
    kind: str
    actor: str
    proposal_id: str | None
    details: dict[str, Any]
    prev_hash: str
    hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "ts": self.ts,
            "kind": self.kind,
            "actor": self.actor,
            "proposal_id": self.proposal_id,
            "details": self.details,
            "prev_hash": self.prev_hash,
            "hash": self.hash,
        }


def _digest(prev_hash: str, body: dict[str, Any]) -> str:
    import hashlib

    payload = canonical_json({"prev": prev_hash, "body": body})
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


class AuditLog:
    """Append-only JSONL audit trail with hash chaining."""

    GENESIS = "sha256:" + "0" * 32

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._events: list[AuditEvent] = []
        self._last_hash = self.GENESIS
        self._counter = 0
        if self.path.exists():
            self._replay()

    # -- loading -------------------------------------------------------------
    def _replay(self) -> None:
        for line in self.path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                # A corrupt line is itself an audit finding.
                self._events.append(AuditEvent(
                    id=f"corrupt-{self._counter}", ts=time.time(), kind="corrupt-record",
                    actor="system", proposal_id=None,
                    details={"raw": line[:200], "error": "unparseable JSON"},
                    prev_hash=self._last_hash,
                    hash=_digest(self._last_hash, {"raw": line[:200]}),
                ))
                self._last_hash = self._events[-1].hash
                self._counter += 1
                continue
            event = AuditEvent(
                id=str(data.get("id", f"evt-{self._counter}")),
                ts=float(data.get("ts", 0.0)),
                kind=str(data.get("kind", "unknown")),
                actor=str(data.get("actor", "system")),
                proposal_id=data.get("proposal_id"),
                details=dict(data.get("details", {})),
                prev_hash=str(data.get("prev_hash", self.GENESIS)),
                hash=str(data.get("hash", "")),
            )
            self._events.append(event)
            self._last_hash = event.hash
            self._counter += 1

    # -- writing -------------------------------------------------------------
    def append(self, kind: str, *, actor: str = "rsi-loop",
               proposal_id: str | None = None,
               details: dict[str, Any] | None = None,
               **extra: Any) -> AuditEvent:
        payload: dict[str, Any] = dict(details or {})
        payload.update(extra)
        safe_details = self._sanitize(payload)
        body = {
            "kind": kind,
            "actor": actor,
            "proposal_id": proposal_id,
            "details": safe_details,
            "ts": round(time.time(), 3),
        }
        self._counter += 1
        event = AuditEvent(
            id=f"evt-{self._counter:06d}",
            ts=body["ts"],
            kind=kind,
            actor=actor,
            proposal_id=proposal_id,
            details=safe_details,
            prev_hash=self._last_hash,
            hash=_digest(self._last_hash, body),
        )
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(event.to_dict()) + "\n")
        self._events.append(event)
        self._last_hash = event.hash
        return event

    @staticmethod
    def _sanitize(details: dict[str, Any]) -> dict[str, Any]:
        text = json.dumps(details, default=str)
        assert_no_secrets(text, what="audit record")
        return json.loads(redact(text))

    # -- reading -------------------------------------------------------------
    def events(self, kind: str | None = None) -> list[AuditEvent]:
        if kind is None:
            return list(self._events)
        return [e for e in self._events if e.kind == kind]

    def counts(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for event in self._events:
            out[event.kind] = out.get(event.kind, 0) + 1
        return out

    def verify_chain(self) -> tuple[bool, list[str]]:
        """Recompute the chain; return (ok, problems)."""
        problems: list[str] = []
        prev = self.GENESIS
        for index, event in enumerate(self._events):
            if event.prev_hash != prev:
                problems.append(
                    f"event {index} ({event.id}, {event.kind}) breaks the chain: "
                    f"prev_hash {event.prev_hash[:16]}... != expected {prev[:16]}..."
                )
            body = {
                "kind": event.kind,
                "actor": event.actor,
                "proposal_id": event.proposal_id,
                "details": event.details,
                "ts": event.ts,
            }
            expected = _digest(prev, body)
            if event.hash != expected:
                problems.append(
                    f"event {index} ({event.id}, {event.kind}) has a mutated hash"
                )
            prev = event.hash
        return (not problems, problems)

    def __len__(self) -> int:
        return len(self._events)


def summarize_events(events: Iterable[AuditEvent]) -> dict[str, int]:
    out: dict[str, int] = {}
    for event in events:
        out[event.kind] = out.get(event.kind, 0) + 1
    return out
