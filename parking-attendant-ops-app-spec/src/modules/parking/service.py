"""
Parking Slot Management and Move Vehicle Use Cases.
"""

from typing import Optional, List
from src.core.domain import IParkingRepository, IAuditLogPort, SlotStatus, ParkingSlot, VehicleType


class MoveVehicleUseCase:
    def __init__(self, parking_repo: IParkingRepository, audit_logger: IAuditLogPort):
        self.parking_repo = parking_repo
        self.audit_logger = audit_logger

    def execute(self, session_id: str, new_slot_id: str, attendant_id: str, reason: str) -> bool:
        """
        Move a parked vehicle to a new slot with strict state updates and audit trail.
        """
        session = self.parking_repo.get_session(session_id)
        if not session or session.state != "ACTIVE":
            raise ValueError(f"Sesi parkir {session_id} tidak aktif.")

        old_slot = self.parking_repo.get_slot(session.slot_id)
        new_slot = self.parking_repo.get_slot(new_slot_id)

        if not new_slot:
            raise ValueError(f"Slot tujuan {new_slot_id} tidak ditemukan.")
        if new_slot.status != SlotStatus.EMPTY:
            raise ValueError(f"Slot tujuan {new_slot.slot_code} tidak kosong (Status: {new_slot.status}).")

        # Update Slot Statuses
        if old_slot:
            old_slot.status = SlotStatus.EMPTY
            old_slot.current_session_id = None
            self.parking_repo.save_slot(old_slot)

        new_slot.status = SlotStatus.OCCUPIED
        new_slot.current_session_id = session.session_id
        self.parking_repo.save_slot(new_slot)

        # Update Session
        old_slot_id = session.slot_id
        session.slot_id = new_slot.slot_id
        self.parking_repo.save_session(session)

        # Audit
        self.audit_logger.record_audit(
            action="MOVE_VEHICLE",
            entity_type="SESSION",
            entity_id=session.session_id,
            actor_id=attendant_id,
            details={
                "from_slot_id": old_slot_id,
                "to_slot_id": new_slot_id,
                "reason": reason
            }
        )
        return True


class ParkingSlotService:
    def __init__(self, parking_repo: IParkingRepository):
        self.parking_repo = parking_repo

    def find_best_empty_slot(self, zone_id: str, vehicle_type: VehicleType) -> Optional[ParkingSlot]:
        """
        Suggest closest available empty slot.
        """
        slots = self.parking_repo.list_empty_slots(zone_id, vehicle_type)
        return slots[0] if slots else None
