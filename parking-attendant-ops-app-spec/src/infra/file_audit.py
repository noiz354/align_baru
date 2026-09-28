"""
Immutable append-only JSON audit ledger with a tamper-evident SHA-256 chain.

Each audit action is a single JSON line in append mode. Sequence numbers and
previous/event hashes are recovered on restart. The only rewrite remains the
explicit one-way plate anonymization required by ADR-004; it re-chains every
entry after masking so verification stays valid.
"""

import hashlib
import json
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List

from src.core.domain import IAuditLogPort


class JsonAuditLogger(IAuditLogPort):
    GENESIS = "0" * 64

    def __init__(self, file_path: str = "audit_ledger.jsonl") -> None:
        self._file_path = file_path
        self._seq = 0
        self._last_hash = self.GENESIS
        self._lock = threading.RLock()
        # Ensure append-only file exists, then recover the durable chain tail.
        open(self._file_path, "a", encoding="utf-8").close()
        self._recover_tail()

    @staticmethod
    def _digest(entry: Dict[str, Any]) -> str:
        body = {key: value for key, value in entry.items() if key != "hash"}
        canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _read_unlocked(self) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        with open(self._file_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
        return entries

    def _recover_tail(self) -> None:
        with self._lock:
            entries = self._read_unlocked()
            if entries:
                self._seq = max(int(entry.get("seq", 0)) for entry in entries)
                last = entries[-1]
                self._last_hash = str(last.get("hash") or self.GENESIS)

    def record_audit(
        self,
        action: str,
        entity_type: str,
        entity_id: str,
        actor_id: str,
        details: Dict[str, Any],
    ) -> None:
        with self._lock:
            self._seq += 1
            entry = {
                "seq": self._seq,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "actor_id": actor_id,
                "details": details,
                "prev_hash": self._last_hash,
            }
            entry["hash"] = self._digest(entry)
            with open(self._file_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, sort_keys=True, default=str) + "\n")
                fh.flush()
            self._last_hash = entry["hash"]

    def read_entries(self) -> List[Dict[str, Any]]:
        with self._lock:
            return self._read_unlocked()

    def verify_chain(self) -> tuple[bool, list[str]]:
        """Recompute sequence and hash links; legacy unchained rows are reported."""
        problems: list[str] = []
        with self._lock:
            entries = self._read_unlocked()
        previous = self.GENESIS
        expected_seq = None
        for index, entry in enumerate(entries):
            seq = int(entry.get("seq", 0))
            if expected_seq is not None and seq != expected_seq + 1:
                problems.append(f"entry {index} sequence gap: {seq} after {expected_seq}")
            expected_seq = seq
            if "prev_hash" not in entry or "hash" not in entry:
                problems.append(f"entry {index} is legacy and has no hash-chain fields")
                previous = str(entry.get("hash") or self.GENESIS)
                continue
            if entry["prev_hash"] != previous:
                problems.append(f"entry {index} previous hash does not match the prior entry")
            expected_hash = self._digest(entry)
            if entry["hash"] != expected_hash:
                problems.append(f"entry {index} content hash mismatch")
            previous = str(entry["hash"])
        return (not problems, problems)

    def anonymize_plates(self, masker) -> int:
        """TASK-602: one-way mask plates, then rebuild every link after approved rewrite."""
        with self._lock:
            entries = self._read_unlocked()
            masked_count = 0
            for entry in entries:
                details = entry.get("details") or {}
                if "plate" in details and isinstance(details["plate"], str):
                    new_plate = masker.mask(details["plate"])
                    if new_plate != details["plate"]:
                        details["plate"] = new_plate
                        masked_count += 1
            previous = self.GENESIS
            for entry in entries:
                entry["prev_hash"] = previous
                entry.pop("hash", None)
                entry["hash"] = self._digest(entry)
                previous = entry["hash"]
            with open(self._file_path, "w", encoding="utf-8") as fh:
                for entry in entries:
                    fh.write(json.dumps(entry, sort_keys=True, default=str) + "\n")
                fh.flush()
            self._seq = max((int(entry.get("seq", 0)) for entry in entries), default=0)
            self._last_hash = previous
            return masked_count
