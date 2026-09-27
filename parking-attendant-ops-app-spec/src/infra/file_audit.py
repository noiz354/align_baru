"""
Immutable append-only JSON audit ledger (TASK-601 / ARCHITECTURE.md).

Each audit action is appended as a single JSON line to a dedicated ledger file.
The file is opened in append mode only; entries are never overwritten except by
the explicit one-way plate anonymization required by ADR-004 (TASK-602).
"""

import json
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List

from src.core.domain import IAuditLogPort


class JsonAuditLogger(IAuditLogPort):
    def __init__(self, file_path: str = "audit_ledger.jsonl") -> None:
        self._file_path = file_path
        self._seq = 0
        self._lock = threading.Lock()
        # Ensure the file exists for append semantics.
        open(self._file_path, "a", encoding="utf-8").close()

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
            }
            with open(self._file_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, default=str) + "\n")

    def read_entries(self) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        with open(self._file_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
        return entries

    def anonymize_plates(self, masker) -> int:
        """TASK-602: one-way mask of plate strings in historical audit details."""
        entries = self.read_entries()
        masked_count = 0
        for entry in entries:
            details = entry.get("details") or {}
            if "plate" in details and isinstance(details["plate"], str):
                new_plate = masker.mask(details["plate"])
                if new_plate != details["plate"]:
                    details["plate"] = new_plate
                    masked_count += 1
        with open(self._file_path, "w", encoding="utf-8") as fh:
            for entry in entries:
                fh.write(json.dumps(entry, default=str) + "\n")
        return masked_count
