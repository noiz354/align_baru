import unittest

from tests.helpers import make_store
from src.core.domain import VehicleType, SlotStatus, SessionState
from src.modules.checkin.service import CheckInUseCase
from src.modules.audit.service import InMemoryAuditLogger
from src.infra.clock import FakeClock
from datetime import datetime, timezone


class TestSqlitePersistence(unittest.TestCase):
    def setUp(self):
        self.store = make_store()

    def test_slot_persistence_and_filter(self):
        empties = self.store.list_empty_slots("z1", VehicleType.MOTORCYCLE)
        # s1, s2 are empty motorcycles; s4 is RESERVED.
        ids = {s.slot_id for s in empties}
        self.assertEqual(ids, {"s1", "s2"})

    def test_session_round_trip(self):
        clock = FakeClock(datetime(2026, 9, 26, 9, 0, 0, tzinfo=timezone.utc))
        checkin = CheckInUseCase(self.store, InMemoryAuditLogger(), clock=clock)
        sess = checkin.execute("B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1")
        reloaded = self.store.get_session(sess.session_id)
        self.assertEqual(reloaded.plate_number.canonical, "B1234ABC")
        self.assertEqual(reloaded.state, SessionState.ACTIVE)
        self.assertEqual(reloaded.vehicle_type, VehicleType.MOTORCYCLE)

    def test_find_active_by_plate(self):
        clock = FakeClock(datetime(2026, 9, 26, 9, 0, 0, tzinfo=timezone.utc))
        checkin = CheckInUseCase(self.store, InMemoryAuditLogger(), clock=clock)
        checkin.execute("B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1")
        found = self.store.find_active_session_by_plate("B1234ABC")
        self.assertIsNotNone(found)
        self.assertEqual(found.slot_id, "s1")

    def test_position_persistence(self):
        slot = self.store.get_slot("s3")
        self.assertEqual((slot.position_x, slot.position_y), (10.0, 5.0))


if __name__ == "__main__":
    unittest.main()
