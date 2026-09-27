"""
Shift Management, Cash Reconciliation, and Active-Vehicle Handover (TASK-501/502/503).
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

from src.core.domain import (
    IAuditLogPort,
    ISystemClock,
    IShiftRepository,
    IParkingRepository,
    ShiftStatus,
)
from src.infra.clock import MonotonicSystemClock


@dataclass
class ShiftRecord:
    shift_id: str
    attendant_id: str
    zone_id: str
    cash_float_start: float
    supervisor_id: Optional[str] = None
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    cash_collected_system: float = 0.0
    qris_collected_system: float = 0.0
    actual_cash_counted: Optional[float] = None
    active_vehicles_handed_over: Optional[int] = None
    cash_variance: Optional[float] = None
    status: ShiftStatus = ShiftStatus.OPEN


@dataclass
class ShiftHandover:
    shift_id: str
    outgoing_attendant_id: str
    incoming_attendant_id: str
    vehicle_inventory: List[dict] = field(default_factory=list)
    confirmed: bool = False
    handed_over_at: Optional[datetime] = None


class ShiftManagementUseCase:
    def __init__(
        self,
        audit_logger: IAuditLogPort,
        shift_repo: Optional[IShiftRepository] = None,
        parking_repo: Optional[IParkingRepository] = None,
        clock: Optional[ISystemClock] = None,
    ):
        self.audit_logger = audit_logger
        self.shift_repo = shift_repo
        self.parking_repo = parking_repo
        self.clock = clock or MonotonicSystemClock()

    def open_shift(
        self,
        shift_id: str,
        attendant_id: str,
        zone_id: str,
        cash_float_start: float,
        supervisor_id: Optional[str] = None,
    ) -> ShiftRecord:
        shift = ShiftRecord(
            shift_id=shift_id,
            attendant_id=attendant_id,
            zone_id=zone_id,
            cash_float_start=cash_float_start,
            supervisor_id=supervisor_id,
            start_time=self.clock.now(),
            status=ShiftStatus.OPEN,
        )
        if self.shift_repo is not None:
            self.shift_repo.save_shift(shift)

        self.audit_logger.record_audit(
            action="OPEN_SHIFT",
            entity_type="SHIFT",
            entity_id=shift_id,
            actor_id=attendant_id,
            details={"cash_float_start": cash_float_start, "zone_id": zone_id},
        )
        return shift

    def record_cash_payment(self, shift_id: str, amount: float, method: str) -> None:
        """Called by CheckOutUseCase path; kept here for direct reconciliation tests."""
        if self.shift_repo is None:
            return
        shift = self.shift_repo.get_shift(shift_id)
        if not shift or shift.status.value != "OPEN":
            return
        if method == "CASH":
            shift.cash_collected_system += amount
        elif method == "QRIS":
            shift.qris_collected_system += amount
        self.shift_repo.save_shift(shift)

    def build_handover_inventory(self, shift_id: str) -> ShiftHandover:
        """
        TASK-502: build the list of vehicles still physically parked when a shift
        ends, so the incoming attendant can perform a joint sign-off.
        """
        shift = self.shift_repo.get_shift(shift_id) if self.shift_repo else None
        zone_id = shift.zone_id if shift else None
        inventory: List[dict] = []
        if self.parking_repo is not None and zone_id and hasattr(self.parking_repo, "list_sessions_by_zone"):
            # Physically-present vehicles (active OR under investigation) must be
            # handed over so the incoming attendant can joint sign-off.
            for session in self.parking_repo.list_sessions_by_zone(zone_id):
                if session.state.value in ("ACTIVE", "UNDER_INVESTIGATION"):
                    inventory.append(
                        {
                            "session_id": session.session_id,
                            "plate": session.plate_number.display_format,
                            "vehicle_type": session.vehicle_type.value,
                            "slot_id": session.slot_id,
                            "state": session.state.value,
                            "check_in_time": session.check_in_time.isoformat(),
                        }
                    )
        return ShiftHandover(
            shift_id=shift_id,
            outgoing_attendant_id=shift.attendant_id if shift else "",
            incoming_attendant_id="",
            vehicle_inventory=inventory,
        )

    def confirm_handover(
        self,
        handover: ShiftHandover,
        incoming_attendant_id: str,
    ) -> ShiftHandover:
        handover.incoming_attendant_id = incoming_attendant_id
        handover.confirmed = True
        handover.handed_over_at = self.clock.now()
        self.audit_logger.record_audit(
            action="SHIFT_HANDOVER",
            entity_type="SHIFT",
            entity_id=handover.shift_id,
            actor_id=incoming_attendant_id,
            details={
                "vehicles_count": len(handover.vehicle_inventory),
                "outgoing": handover.outgoing_attendant_id,
            },
        )
        return handover

    def close_and_reconcile_shift(
        self,
        shift_id: str,
        actual_cash_counted: float,
        active_vehicles_count: int,
        supervisor_id: Optional[str] = None,
        approved_cash_expenses: float = 0.0,
    ) -> ShiftRecord:
        if self.shift_repo is None:
            raise RuntimeError("Shift repository is required to close a shift.")
        shift = self.shift_repo.get_shift(shift_id)
        if not shift or shift.status != ShiftStatus.OPEN:
            raise ValueError(f"Shift {shift_id} tidak ditemukan atau sudah ditutup.")

        now = self.clock.now()
        shift.end_time = now
        shift.actual_cash_counted = actual_cash_counted
        shift.active_vehicles_handed_over = active_vehicles_count

        # SHIFT.md reconciliation formula:
        # expected = float_start + cash_collected - approved_expenses
        expected_cash = (
            shift.cash_float_start
            + shift.cash_collected_system
            - approved_cash_expenses
        )
        shift.cash_variance = actual_cash_counted - expected_cash
        shift.status = ShiftStatus.CLOSED
        if supervisor_id:
            shift.supervisor_id = supervisor_id

        self.shift_repo.save_shift(shift)

        self.audit_logger.record_audit(
            action="CLOSE_SHIFT",
            entity_type="SHIFT",
            entity_id=shift_id,
            actor_id=shift.attendant_id,
            details={
                "expected_cash": expected_cash,
                "actual_cash_counted": actual_cash_counted,
                "approved_cash_expenses": approved_cash_expenses,
                "variance": shift.cash_variance,
                "active_vehicles_handed_over": active_vehicles_count,
                "supervisor_id": supervisor_id,
            },
        )
        return shift
