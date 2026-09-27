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
    freeze_retention: bool = False
    severity: str = "MEDIUM"
    supervisor_id: Optional[str] = None


class IncidentService:
    def __init__(self, parking_repo: IParkingRepository, audit_logger: IAuditLogPort):
        self.parking_repo = parking_repo
        self.audit_logger = audit_logger

    def report_incident(
        self,
        category: IncidentCategory,
        description: str,
        attendant_id: str,
        session_id: Optional[str] = None,
        photo_ids: Optional[List[str]] = None,
        severity: str = "MEDIUM",
        supervisor_id: Optional[str] = None,
        police_report_no: Optional[str] = None,
    ) -> IncidentReport:
        incident_id = f"inc_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc)

        # ADR-004: any open incident freezes its session's data retention.
        freeze = session_id is not None

        report = IncidentReport(
            incident_id=incident_id,
            session_id=session_id,
            category=category,
            description=description,
            attendant_id=attendant_id,
            reported_at=now,
            photo_evidence_ids=photo_ids or [],
            police_report_no=police_report_no,
            freeze_retention=freeze,
            severity=severity,
            supervisor_id=supervisor_id,
        )

        # Persist incident and freeze the linked session's retention.
        if hasattr(self.parking_repo, "save_incident"):
            self.parking_repo.save_incident(report)

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
                "photos_count": len(report.photo_evidence_ids),
                "freeze_retention": freeze,
            },
        )

        return report
