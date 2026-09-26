"""
Shift lifecycle, Cash Handover, and Physical Reconciliation.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, List
from src.core.domain import ShiftStatus, IAuditLogPort


@dataclass
class ShiftRecord:
    shift_id: str
    attendant_id: str
    zone_id: str
    start_time: datetime
    cash_float_start: float
    end_time: Optional[datetime] = None
    cash_collected_system: float = 0.0
    qris_collected_system: float = 0.0
    actual_cash_counted: Optional[float] = None
    cash_variance: Optional[float] = None
    active_vehicles_handed_over: int = 0
    status: ShiftStatus = ShiftStatus.OPEN


class ShiftManagementUseCase:
    def __init__(self, audit_logger: IAuditLogPort):
        self.audit_logger = audit_logger
        self._shifts = {}

    def open_shift(self, shift_id: str, attendant_id: str, zone_id: str, cash_float_start: float) -> ShiftRecord:
        shift = ShiftRecord(
            shift_id=shift_id,
            attendant_id=attendant_id,
            zone_id=zone_id,
            start_time=datetime.now(timezone.utc),
            cash_float_start=cash_float_start,
            status=ShiftStatus.OPEN
        )
        self._shifts[shift_id] = shift

        self.audit_logger.record_audit(
            action="OPEN_SHIFT",
            entity_type="SHIFT",
            entity_id=shift_id,
            actor_id=attendant_id,
            details={"cash_float_start": cash_float_start, "zone_id": zone_id}
        )
        return shift

    def close_and_reconcile_shift(
        self,
        shift_id: str,
        actual_cash_counted: float,
        active_vehicles_count: int,
        supervisor_id: Optional[str] = None
    ) -> ShiftRecord:
        shift = self._shifts.get(shift_id)
        if not shift or shift.status != ShiftStatus.OPEN:
            raise ValueError(f"Shift {shift_id} tidak ditemukan atau sudah ditutup.")

        now = datetime.now(timezone.utc)
        shift.end_time = now
        shift.actual_cash_counted = actual_cash_counted
        shift.active_vehicles_handed_over = active_vehicles_count

        expected_cash = shift.cash_float_start + shift.cash_collected_system
        shift.cash_variance = actual_cash_counted - expected_cash
        shift.status = ShiftStatus.CLOSED

        self.audit_logger.record_audit(
            action="CLOSE_SHIFT",
            entity_type="SHIFT",
            entity_id=shift_id,
            actor_id=shift.attendant_id,
            details={
                "expected_cash": expected_cash,
                "actual_cash_counted": actual_cash_counted,
                "variance": shift.cash_variance,
                "active_vehicles_handed_over": active_vehicles_count,
                "supervisor_id": supervisor_id
            }
        )
        return shift
