"""
Vehicle Check-In Use Case orchestration.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from src.core.domain import (
    IParkingRepository,
    IAuditLogPort,
    ISystemClock,
    ParkingSession,
    ParkingSlot,
    SlotStatus,
    SessionState,
    VehicleType,
    ObservedItem,
    PhotoEvidence
)
from src.modules.vehicle.service import PlateSanitizer
from src.infra.clock import MonotonicSystemClock


class CheckInUseCase:
    def __init__(
        self,
        parking_repo: IParkingRepository,
        audit_logger: IAuditLogPort,
        clock: Optional[ISystemClock] = None,
    ):
        self.parking_repo = parking_repo
        self.audit_logger = audit_logger
        self.clock = clock or MonotonicSystemClock()

    def execute(
        self,
        raw_plate: str,
        vehicle_type: VehicleType,
        color: str,
        slot_id: str,
        attendant_id: str,
        shift_id: str,
        initial_notes: str = "",
        observed_items: Optional[List[ObservedItem]] = None,
        photos: Optional[List[PhotoEvidence]] = None
    ) -> ParkingSession:
        plate = PlateSanitizer.sanitize(raw_plate)

        # Invariant 1: Kendaraan dengan plat yang sama tidak boleh memiliki 2 sesi ACTIVE bersamaan
        existing_active = self.parking_repo.find_active_session_by_plate(plate.canonical)
        if existing_active:
            raise ValueError(f"Kendaraan {plate.display_format} sudah tercatat aktif di slot {existing_active.slot_id}.")

        # Invariant 2: Slot harus berstatus EMPTY
        slot = self.parking_repo.get_slot(slot_id)
        if not slot:
            raise ValueError(f"Slot {slot_id} tidak ditemukan.")
        if slot.status != SlotStatus.EMPTY:
            raise ValueError(f"Slot {slot.slot_code} sedang tidak kosong (Status: {slot.status}).")

        session_id = f"ses_{uuid.uuid4().hex[:12]}"
        now = self.clock.now()

        session = ParkingSession(
            session_id=session_id,
            plate_number=plate,
            vehicle_type=vehicle_type,
            color=color,
            slot_id=slot_id,
            check_in_time=now,
            check_in_attendant_id=attendant_id,
            shift_id=shift_id,
            state=SessionState.ACTIVE,
            initial_condition_notes=initial_notes,
            observed_items=observed_items or [],
            photos=photos or []
        )

        # Update Slot
        slot.status = SlotStatus.OCCUPIED
        slot.current_session_id = session_id
        self.parking_repo.save_slot(slot)

        # Save Session
        self.parking_repo.save_session(session)

        # OFFLINE.md: emit a transactional outbox event for background sync.
        if hasattr(self.parking_repo, "enqueue_outbox"):
            self.parking_repo.enqueue_outbox(
                f"out_{session.session_id}", "VehicleCheckedIn",
                {
                    "session_id": session.session_id,
                    "plate": plate.display_format,
                    "slot_id": session.slot_id,
                    "vehicle_type": vehicle_type.value,
                    "shift_id": shift_id,
                },
            )

        # Audit
        self.audit_logger.record_audit(
            action="CHECK_IN",
            entity_type="SESSION",
            entity_id=session_id,
            actor_id=attendant_id,
            details={
                "plate": plate.display_format,
                "slot_code": slot.slot_code,
                "shift_id": shift_id,
                "observed_items_count": len(session.observed_items)
            }
        )

        return session
