"""
Parking Slot Management, Slot State Machine, and Move Vehicle Use Cases.
"""

from typing import Optional, List, Tuple
from src.core.domain import (
    IParkingRepository,
    IAuditLogPort,
    SlotStatus,
    ParkingSlot,
    VehicleType,
)


class SlotStateMachine:
    """TASK-201: explicit slot lifecycle state machine (PARKING.md).

    Allowed transitions:
      EMPTY   -> OCCUPIED | BLOCKED | RESERVED
      OCCUPIED-> EMPTY
      BLOCKED -> EMPTY
      RESERVED-> EMPTY
    (OCCUPIED -> OCCUPIED is handled by MoveVehicleUseCase.)
    """

    _ALLOWED = {
        SlotStatus.EMPTY: {SlotStatus.OCCUPIED, SlotStatus.BLOCKED, SlotStatus.RESERVED},
        SlotStatus.OCCUPIED: {SlotStatus.EMPTY},
        SlotStatus.BLOCKED: {SlotStatus.EMPTY},
        SlotStatus.RESERVED: {SlotStatus.EMPTY},
    }

    @classmethod
    def can_transition(cls, current: SlotStatus, target: SlotStatus) -> bool:
        return target in cls._ALLOWED.get(current, set())

    @classmethod
    def transition(
        cls,
        slot: ParkingSlot,
        target: SlotStatus,
        repo: IParkingRepository,
        audit_logger: IAuditLogPort,
        actor_id: str,
        reason: str = "",
    ) -> ParkingSlot:
        if not cls.can_transition(slot.status, target):
            raise ValueError(
                f"Transisi {slot.status.value} -> {target.value} tidak diizinkan "
                f"untuk slot {slot.slot_code}."
            )
        previous = slot.status
        slot.status = target
        if target == SlotStatus.EMPTY:
            slot.current_session_id = None
        repo.save_slot(slot)
        audit_logger.record_audit(
            action="SLOT_STATE_CHANGE",
            entity_type="SLOT",
            entity_id=slot.slot_id,
            actor_id=actor_id,
            details={
                "slot_code": slot.slot_code,
                "from": previous.value,
                "to": target.value,
                "reason": reason,
            },
        )
        return slot

    # Convenience wrappers used by supervisors / maintenance.
    @classmethod
    def block(cls, slot, repo, audit_logger, actor_id, reason="Maintenance / genangan"):
        return cls.transition(slot, SlotStatus.BLOCKED, repo, audit_logger, actor_id, reason)

    @classmethod
    def unblock(cls, slot, repo, audit_logger, actor_id):
        return cls.transition(slot, SlotStatus.EMPTY, repo, audit_logger, actor_id, "Unblock")

    @classmethod
    def reserve(cls, slot, repo, audit_logger, actor_id, reason="Reserved"):
        return cls.transition(slot, SlotStatus.RESERVED, repo, audit_logger, actor_id, reason)


class MoveVehicleUseCase:
    def __init__(self, parking_repo: IParkingRepository, audit_logger: IAuditLogPort):
        self.parking_repo = parking_repo
        self.audit_logger = audit_logger

    def execute(self, session_id: str, new_slot_id: str, attendant_id: str, reason: str) -> bool:
        """
        Move a parked vehicle to a new slot with strict state updates and audit trail.
        """
        session = self.parking_repo.get_session(session_id)
        if not session or session.state.value != "ACTIVE":
            raise ValueError(f"Sesi parkir {session_id} tidak aktif.")

        old_slot = self.parking_repo.get_slot(session.slot_id)
        new_slot = self.parking_repo.get_slot(new_slot_id)

        if not new_slot:
            raise ValueError(f"Slot tujuan {new_slot_id} tidak ditemukan.")
        if new_slot.status != SlotStatus.EMPTY:
            raise ValueError(f"Slot tujuan {new_slot.slot_code} tidak kosong (Status: {new_slot.status}).")

        # Validate the release + occupy transitions via the state machine.
        if old_slot and not SlotStateMachine.can_transition(old_slot.status, SlotStatus.EMPTY):
            raise ValueError(f"Slot asal {old_slot.slot_code} tidak dapat dibebaskan.")
        if not SlotStateMachine.can_transition(new_slot.status, SlotStatus.OCCUPIED):
            raise ValueError(f"Slot tujuan {new_slot.slot_code} tidak dapat diisi.")

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
                "reason": reason,
            },
        )

        if hasattr(self.parking_repo, "enqueue_outbox"):
            self.parking_repo.enqueue_outbox(
                f"out_move_{session.session_id}", "VehicleMoved",
                {"session_id": session.session_id, "from": old_slot_id, "to": new_slot_id},
            )
        return True


def _distance(a: ParkingSlot, x: float, y: float) -> float:
    return ((a.position_x - x) ** 2 + (a.position_y - y) ** 2) ** 0.5


class ParkingSlotService:
    def __init__(self, parking_repo: IParkingRepository):
        self.parking_repo = parking_repo

    def find_best_empty_slot(self, zone_id: str, vehicle_type: VehicleType) -> Optional[ParkingSlot]:
        """
        TASK-202: suggest closest available empty slot (falls back to first).
        """
        slots = self.parking_repo.list_empty_slots(zone_id, vehicle_type)
        return slots[0] if slots else None

    def find_nearest_empty_slot(
        self,
        zone_id: str,
        vehicle_type: VehicleType,
        reference: Tuple[float, float],
    ) -> Optional[ParkingSlot]:
        """
        TASK-202: nearest empty slot to a reference point (e.g. entrance gate)
        using euclidean distance over slot layout coordinates.
        """
        slots = self.parking_repo.list_empty_slots(zone_id, vehicle_type)
        if not slots:
            return None
        rx, ry = reference
        return min(slots, key=lambda s: _distance(s, rx, ry))
