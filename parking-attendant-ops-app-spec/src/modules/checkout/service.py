"""
Vehicle Check-Out Use Case, Mismatch Alerting, and Slot Releasing.
"""

from datetime import datetime, timezone
from typing import Optional
from src.core.domain import (
    IParkingRepository,
    IAuditLogPort,
    ParkingSession,
    SlotStatus,
    SessionState,
    PaymentStatus
)
from src.modules.pricing.service import PricingEngine


class CheckOutUseCase:
    def __init__(self, parking_repo: IParkingRepository, audit_logger: IAuditLogPort):
        self.parking_repo = parking_repo
        self.audit_logger = audit_logger

    def evaluate_mismatch(
        self,
        session: ParkingSession,
        scanned_plate: str,
        observed_color: Optional[str] = None
    ) -> bool:
        """
        Returns True if mismatch is detected, requiring supervisor verification.
        """
        clean_scanned = scanned_plate.replace(" ", "").upper()
        if session.plate_number.canonical != clean_scanned:
            return True
        if observed_color and observed_color.upper() != session.color.upper():
            return True
        return False

    def execute(
        self,
        session_id: str,
        attendant_id: str,
        payment_method: str,  # CASH, QRIS, WAIVED
        is_lost_ticket: bool = False,
        is_waived: bool = False,
        supervisor_pin: Optional[str] = None
    ) -> ParkingSession:
        session = self.parking_repo.get_session(session_id)
        if not session or session.state != SessionState.ACTIVE:
            raise ValueError(f"Sesi parkir {session_id} tidak aktif.")

        if (is_lost_ticket or is_waived) and not supervisor_pin:
            raise PermissionError("Otorisasi Supervisor (PIN) diwajibkan untuk Lost Ticket atau Biaya Dihapus.")

        now = datetime.now(timezone.utc)
        pricing = PricingEngine.calculate(
            check_in_time=session.check_in_time,
            check_out_time=now,
            vehicle_type=session.vehicle_type,
            is_lost_ticket=is_lost_ticket,
            is_waived=is_waived
        )

        session.check_out_time = now
        session.check_out_attendant_id = attendant_id
        session.pricing = pricing
        session.payment_status = PaymentStatus.OVERRIDE_WAIVED if is_waived else PaymentStatus.PAID
        session.state = SessionState.CHECKED_OUT

        # Free the slot
        slot = self.parking_repo.get_slot(session.slot_id)
        if slot:
            slot.status = SlotStatus.EMPTY
            slot.current_session_id = None
            self.parking_repo.save_slot(slot)

        # Save session
        self.parking_repo.save_session(session)

        # Audit
        self.audit_logger.record_audit(
            action="CHECK_OUT",
            entity_type="SESSION",
            entity_id=session.session_id,
            actor_id=attendant_id,
            details={
                "plate": session.plate_number.display_format,
                "billable_hours": pricing.billable_hours,
                "total_fee": pricing.total_fee,
                "payment_method": payment_method,
                "is_lost_ticket": is_lost_ticket,
                "is_waived": is_waived
            }
        )

        return session
