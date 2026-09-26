"""
Incident reporting, property loss claims, and retention freezing.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
from src.core.domain import IncidentCategory, IAuditLogPort, IParkingRepository


@dataclass
class IncidentReport:
    incident_id: str
    session_id: Optional[str]
    category: IncidentCategory
    description: str
    attendant_id: str
    reported_at: datetime
    photo_evidence_ids: List[str] = field(default_factory=list)
    police_report_no: Optional[str] = None
    is_resolved: bool = False


class IncidentService:
    def __init__(self, parking_repo: IParkingRepository, audit_logger: IAuditLogPort):
        self.parking_repo = parking_repo
        self.audit_logger = audit_logger
        self._incidents = {}

    def report_incident(
        self,
        category: IncidentCategory,
        description: str,
        attendant_id: str,
        session_id: Optional[str] = None,
        photo_ids: Optional[List[str]] = None
    ) -> IncidentReport:
        incident_id = f"inc_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc)

        report = IncidentReport(
            incident_id=incident_id,
            session_id=session_id,
            category=category,
            description=description,
            attendant_id=attendant_id,
            reported_at=now,
            photo_evidence_ids=photo_ids or []
        )
        self._incidents[incident_id] = report

        # Jika terkait dengan sesi parkir, tandai freeze retention agar foto tidak dihapus oleh cron 30 hari
        if session_id:
            session = self.parking_repo.get_session(session_id)
            if session:
                session.has_active_incident = True
                self.parking_repo.save_session(session)

        self.audit_logger.record_audit(
            action="REPORT_INCIDENT",
            entity_type="INCIDENT",
            entity_id=incident_id,
            actor_id=attendant_id,
            details={
                "category": category.value,
                "session_id": session_id,
                "photos_count": len(report.photo_evidence_ids)
            }
        )

        return report
