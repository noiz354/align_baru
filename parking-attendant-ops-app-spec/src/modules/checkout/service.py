"""
Vehicle Check-Out Use Case, Mismatch Alerting, Lost Ticket, and Slot Releasing.
"""

from datetime import datetime, timezone
from typing import Optional
from src.core.domain import (
    IParkingRepository,
    IAuditLogPort,
    ISystemClock,
    IShiftRepository,
    ParkingSession,
    SlotStatus,
    SessionState,
    PaymentStatus
)
from src.modules.pricing.service import PricingEngine
from src.infra.clock import MonotonicSystemClock, validate_non_decreasing


class CheckOutUseCase:
    def __init__(
        self,
        parking_repo: IParkingRepository,
        audit_logger: IAuditLogPort,
        clock: Optional[ISystemClock] = None,
        shift_repo: Optional[IShiftRepository] = None,
    ):
        self.parking_repo = parking_repo
        self.audit_logger = audit_logger
        self.clock = clock or MonotonicSystemClock()
        self.shift_repo = shift_repo

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

    def flag_mismatch(self, session: ParkingSession, attendant_id: str, reason: str) -> ParkingSession:
        """Move a session into UNDER_INVESTIGATION and audit the hold (DOMAIN.md)."""
        if session.state != SessionState.ACTIVE:
            raise ValueError(f"Sesi parkir {session.session_id} tidak aktif.")
        session.state = SessionState.UNDER_INVESTIGATION
        self.parking_repo.save_session(session)
        self.audit_logger.record_audit(
            action="MISMATCH_HOLD",
            entity_type="SESSION",
            entity_id=session.session_id,
            actor_id=attendant_id,
            details={"reason": reason},
        )
        return session

    def execute(
        self,
        session_id: str,
        attendant_id: str,
        payment_method: str,  # CASH or WAIVED; QRIS requires verified provider integration
        is_lost_ticket: bool = False,
        is_waived: bool = False,
        supervisor_pin: Optional[str] = None
    ) -> ParkingSession:
        # PRD §4.A.7 / SECURITY.md: a QRIS request is NOT proof of settlement.
        # Until a provider-authenticated callback + amount reconciliation exist,
        # fail *before* any slot/session/shift mutation. Never report fake PAID.
        if payment_method == "QRIS":
            raise ValueError("QRIS requires verified provider settlement before checkout")
        if payment_method not in ("CASH", "WAIVED") or (payment_method == "WAIVED") != is_waived:
            raise ValueError("Payment method must be CASH, or WAIVED with is_waived=True")
        session = self.parking_repo.get_session(session_id)
        if not session or session.state not in (SessionState.ACTIVE, SessionState.UNDER_INVESTIGATION):
            raise ValueError(f"Sesi parkir {session_id} tidak dalam status dapat di-checkout.")

        if (is_lost_ticket or is_waived) and not supervisor_pin:
            raise PermissionError("Otorisasi Supervisor (PIN) diwajibkan untuk Lost Ticket atau Biaya Dihapus.")

        now = self.clock.now()
        # TASK-402 / ADR-002 / SECURITY: reject artificially rolled-back clocks.
        validate_non_decreasing(session.check_in_time, now)

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

        if hasattr(self.parking_repo, "enqueue_outbox"):
            self.parking_repo.enqueue_outbox(
                f"out_{session.session_id}", "VehicleCheckedOut",
                {
                    "session_id": session.session_id,
                    "plate": session.plate_number.display_format,
                    "total_fee": pricing.total_fee,
                    "payment_method": payment_method,
                },
            )

        # Record cash/QRIS collection against the attendant's open shift (SHIFT.md).
        if self.shift_repo is not None and payment_method in ("CASH", "QRIS"):
            shift = self.shift_repo.get_shift(session.shift_id)
            if shift and shift.status.value == "OPEN":
                if payment_method == "CASH":
                    shift.cash_collected_system = (
                        float(shift.cash_collected_system or 0.0) + pricing.total_fee
                    )
                else:
                    shift.qris_collected_system = (
                        float(shift.qris_collected_system or 0.0) + pricing.total_fee
                    )
                self.shift_repo.save_shift(shift)

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


class LostTicketVerificationUseCase:
    """TASK-404 / ADR-005: lost-ticket flow with dual-authorization.

    Requires physical STNK + KTP verification and a supervisor PIN before the
    pricing engine applies the lost-ticket fine.
    """

    def __init__(
        self,
        parking_repo: IParkingRepository,
        audit_logger: IAuditLogPort,
        supervisor_pins: Optional[dict] = None,
        clock: Optional[ISystemClock] = None,
        shift_repo: Optional[IShiftRepository] = None,
    ):
        self.parking_repo = parking_repo
        self.audit_logger = audit_logger
        # In production PINs live in a secure store; demo default is "1234".
        self.supervisor_pins = supervisor_pins if supervisor_pins is not None else {"spv_hendra_02": "1234"}
        self.clock = clock or MonotonicSystemClock()
        self.shift_repo = shift_repo

    def verify_and_checkout(
        self,
        session_id: str,
        attendant_id: str,
        supervisor_id: str,
        supervisor_pin: str,
        driver_name: str,
        driver_nik: str,
        stnk_photo_evidence_id: str,
        ktp_photo_evidence_id: str,
        payment_method: str = "CASH",
    ) -> ParkingSession:
        # No production QRIS adapter exists; never close a lost-ticket session
        # as PAID on an unverified digital-payment request (PRD §4.A.7).
        if payment_method != "CASH":
            raise ValueError("Lost-ticket checkout requires verified CASH payment; QRIS is not configured")
        if self.supervisor_pins.get(supervisor_id) != supervisor_pin:
            raise PermissionError("PIN Supervisor tidak valid untuk resolusi tiket hilang.")

        session = self.parking_repo.get_session(session_id)
        if not session or session.state != SessionState.ACTIVE:
            raise ValueError(f"Sesi parkir {session_id} tidak aktif.")

        # Required physical identity verification (ADR-005).
        if not (stnk_photo_evidence_id and ktp_photo_evidence_id and driver_name and driver_nik):
            raise ValueError("Verifikasi STNK, KTP, Nama, dan NIK wajib diisi untuk tiket hilang.")

        now = self.clock.now()
        validate_non_decreasing(session.check_in_time, now)

        pricing = PricingEngine.calculate(
            check_in_time=session.check_in_time,
            check_out_time=now,
            vehicle_type=session.vehicle_type,
            is_lost_ticket=True,
        )

        session.check_out_time = now
        session.check_out_attendant_id = attendant_id
        session.pricing = pricing
        session.payment_status = PaymentStatus.PAID
        session.state = SessionState.CHECKED_OUT

        slot = self.parking_repo.get_slot(session.slot_id)
        if slot:
            slot.status = SlotStatus.EMPTY
            slot.current_session_id = None
            self.parking_repo.save_slot(slot)

        self.parking_repo.save_session(session)

        # Record the lost-ticket collection against the attendant's open shift.
        if self.shift_repo is not None:
            shift = self.shift_repo.get_shift(session.shift_id)
            if shift and shift.status.value == "OPEN":
                shift.cash_collected_system = (
                    float(shift.cash_collected_system or 0.0) + pricing.total_fee
                )
                self.shift_repo.save_shift(shift)

        self.audit_logger.record_audit(
            action="LOST_TICKET_CHECKOUT",
            entity_type="SESSION",
            entity_id=session.session_id,
            actor_id=attendant_id,
            details={
                "plate": session.plate_number.display_format,
                "total_fee": pricing.total_fee,
                "lost_ticket_fine": pricing.lost_ticket_fee,
                "supervisor_id": supervisor_id,
                "driver_nik": driver_nik,
                "payment_method": payment_method,
            },
        )
        return session
