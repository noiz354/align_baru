"""
Immutable audit ledger and privacy data anonymization.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Any, List
from src.core.domain import IAuditLogPort


@dataclass
class AuditEntry:
    timestamp: datetime
    action: str
    entity_type: str
    entity_id: str
    actor_id: str
    details: Dict[str, Any]


class InMemoryAuditLogger(IAuditLogPort):
    def __init__(self):
        self._entries: List[AuditEntry] = []

    def record_audit(
        self,
        action: str,
        entity_type: str,
        entity_id: str,
        actor_id: str,
        details: Dict[str, Any]
    ) -> None:
        entry = AuditEntry(
            timestamp=datetime.now(timezone.utc),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            details=details
        )
        self._entries.append(entry)

    def get_entries(self) -> List[AuditEntry]:
        return list(self._entries)


class PrivacyRetentionService:
    @staticmethod
    def mask_plate_for_history(plate: str) -> str:
        """
        Masks middle registration number to protect citizen privacy in old reports (GDPR/UU PDP).
        e.g. 'B 1234 ABC' -> 'B 1*** ABC'
        """
        parts = plate.split(" ")
        if len(parts) == 3:
            num = parts[1]
            masked_num = num[0] + ("*" * (len(num) - 1)) if len(num) > 1 else "*"
            return f"{parts[0]} {masked_num} {parts[2]}"
        return plate[:3] + "****"
