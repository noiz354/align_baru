import unittest

from tests.helpers import make_store
from src.core.domain import SlotStatus, VehicleType
from src.modules.parking.service import SlotStateMachine, MoveVehicleUseCase, ParkingSlotService
from src.infra.clock import MonotonicSystemClock


class TestSlotStateMachine(unittest.TestCase):
    def setUp(self):
        self.store = make_store()
        self.clock = MonotonicSystemClock()

        class _Audit:
            def record_audit(self, *a, **k):
                pass

        self.audit = _Audit()

    def test_allowed_transitions(self):
        self.assertTrue(SlotStateMachine.can_transition(SlotStatus.EMPTY, SlotStatus.OCCUPIED))
        self.assertTrue(SlotStateMachine.can_transition(SlotStatus.EMPTY, SlotStatus.BLOCKED))
        self.assertTrue(SlotStateMachine.can_transition(SlotStatus.EMPTY, SlotStatus.RESERVED))
        self.assertTrue(SlotStateMachine.can_transition(SlotStatus.BLOCKED, SlotStatus.EMPTY))

    def test_disallowed_transition(self):
        slot = self.store.get_slot("s4")  # RESERVED
        # RESERVED cannot go straight to OCCUPIED
        self.assertFalse(SlotStateMachine.can_transition(SlotStatus.RESERVED, SlotStatus.OCCUPIED))
        with self.assertRaises(ValueError):
            SlotStateMachine.transition(slot, SlotStatus.OCCUPIED, self.store, self.audit, "att", "x")

    def test_block_unblock(self):
        slot = self.store.get_slot("s1")
        SlotStateMachine.block(slot, self.store, self.audit, "att")
        self.assertEqual(self.store.get_slot("s1").status, SlotStatus.BLOCKED)
        SlotStateMachine.unblock(self.store.get_slot("s1"), self.store, self.audit, "att")
        self.assertEqual(self.store.get_slot("s1").status, SlotStatus.EMPTY)


class TestMoveVehicle(unittest.TestCase):
    def setUp(self):
        self.store = make_store()

        class _Audit:
            def record_audit(self, *a, **k):
                pass

        self.audit = _Audit()
        self.store.save_session = self.store.save_session  # ensure present

    def test_move(self):
        # Create a real active session in s1, then relocate it to s2.
        from src.modules.checkin.service import CheckInUseCase
        from src.modules.audit.service import InMemoryAuditLogger
        from src.infra.clock import FakeClock
        from datetime import datetime, timezone
        clock = FakeClock(datetime(2026, 9, 26, 9, 0, 0, tzinfo=timezone.utc))
        sess = CheckInUseCase(self.store, InMemoryAuditLogger(), clock=clock).execute(
            "B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att", "shf1"
        )

        uc = MoveVehicleUseCase(self.store, self.audit)
        ok = uc.execute(sess.session_id, "s2", "att", "REORGANIZATION")
        self.assertTrue(ok)
        self.assertEqual(self.store.get_slot("s1").status, SlotStatus.EMPTY)
        self.assertEqual(self.store.get_slot("s2").status, SlotStatus.OCCUPIED)
        self.assertEqual(self.store.get_session(sess.session_id).slot_id, "s2")

    def test_move_to_occupied_fails(self):
        for sid in ("s1", "s2"):
            s = self.store.get_slot(sid)
            s.status = SlotStatus.OCCUPIED
            self.store.save_slot(s)
        uc = MoveVehicleUseCase(self.store, self.audit)
        with self.assertRaises(ValueError):
            uc.execute("ses_x", "s2", "att", "x")


class TestNearestSlot(unittest.TestCase):
    def test_find_nearest(self):
        svc = ParkingSlotService(make_store())
        # Entrance gate at (0,0) -> s1 is closest among motorcycle empties.
        nearest = svc.find_nearest_empty_slot("z1", VehicleType.MOTORCYCLE, (0, 0))
        self.assertEqual(nearest.slot_id, "s1")

    def test_car_only(self):
        svc = ParkingSlotService(make_store())
        nearest = svc.find_nearest_empty_slot("z1", VehicleType.CAR, (10, 5))
        self.assertEqual(nearest.slot_id, "s3")


if __name__ == "__main__":
    unittest.main()
