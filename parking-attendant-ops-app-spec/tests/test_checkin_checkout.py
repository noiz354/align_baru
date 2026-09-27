import unittest
from datetime import datetime, timezone, timedelta

from tests.helpers import make_store
from src.infra.clock import FakeClock, MonotonicSystemClock
from src.modules.checkin.service import CheckInUseCase
from src.modules.checkout.service import CheckOutUseCase, LostTicketVerificationUseCase
from src.modules.shift.service import ShiftManagementUseCase
from src.modules.audit.service import InMemoryAuditLogger
from src.core.domain import VehicleType, SessionState, SlotStatus


class TestCheckInCheckOutFlow(unittest.TestCase):
    def setUp(self):
        self.store = make_store()
        self.start = datetime(2026, 9, 26, 9, 0, 0, tzinfo=timezone.utc)
        self.clock = FakeClock(self.start)
        self.audit = InMemoryAuditLogger()
        self.shift = ShiftManagementUseCase(self.audit, shift_repo=self.store, clock=self.clock)
        self.shift.open_shift("shf1", "att1", "z1", 100000.0, supervisor_id="spv1")

        self.checkin = CheckInUseCase(self.store, self.audit, clock=self.clock)
        self.checkout = CheckOutUseCase(
            self.store, self.audit, clock=self.clock, shift_repo=self.store
        )

    def _checkin(self, plate="B 1234 ABC", slot="s1"):
        return self.checkin.execute(
            raw_plate=plate,
            vehicle_type=VehicleType.MOTORCYCLE,
            color="BLACK",
            slot_id=slot,
            attendant_id="att1",
            shift_id="shf1",
        )

    def test_full_flow_two_hours_cash(self):
        session = self._checkin()
        self.assertEqual(session.state, SessionState.ACTIVE)
        self.assertEqual(self.store.get_slot("s1").status, SlotStatus.OCCUPIED)

        self.clock.advance(timedelta(hours=2))
        out = self.checkout.execute(session.session_id, "att1", "CASH")
        self.assertEqual(out.state, SessionState.CHECKED_OUT)
        self.assertEqual(out.pricing.total_fee, 3000.0)  # 2h motorcycle
        self.assertEqual(self.store.get_slot("s1").status, SlotStatus.EMPTY)

        # Cash recorded against the shift.
        shift = self.store.get_shift("shf1")
        self.assertEqual(shift.cash_collected_system, 3000.0)

    def test_duplicate_active_plate_rejected(self):
        self._checkin("B 1234 ABC")
        with self.assertRaises(ValueError):
            self._checkin("b 1234 abc")

    def test_mismatch_detection(self):
        session = self._checkin("B 1234 ABC")
        self.assertTrue(
            self.checkout.evaluate_mismatch(session, "B 9999 ZZZ", "BLACK")
        )
        self.assertFalse(
            self.checkout.evaluate_mismatch(session, "B 1234 ABC", "BLACK")
        )

    def test_rolled_back_clock_rejected(self):
        session = self._checkin()
        # Simulate a device clock rolled backwards so checkout < check-in.
        class _BackClock:
            def now(self):
                return self.start - timedelta(minutes=5)

        tampered = CheckOutUseCase(self.store, self.audit, clock=_BackClock())
        with self.assertRaises(Exception):
            tampered.execute(session.session_id, "att1", "CASH")


class TestLostTicket(unittest.TestCase):
    def setUp(self):
        self.store = make_store()
        self.start = datetime(2026, 9, 26, 9, 0, 0, tzinfo=timezone.utc)
        self.clock = FakeClock(self.start)
        self.audit = InMemoryAuditLogger()
        self.checkin = CheckInUseCase(self.store, self.audit, clock=self.clock)
        self.lost = LostTicketVerificationUseCase(
            self.store, self.audit, supervisor_pins={"spv1": "1234"}, clock=self.clock
        )

    def test_lost_ticket_requires_pin(self):
        session = self.checkin.execute("B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1")
        self.clock.advance(timedelta(hours=2))
        with self.assertRaises(PermissionError):
            self.lost.verify_and_checkout(
                session.session_id, "att1", "spv1", "0000",
                "Budi", "3171...", "evi_stnk", "evi_ktp",
            )

    def test_lost_ticket_success(self):
        session = self.checkin.execute("B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1")
        self.clock.advance(timedelta(hours=2))
        out = self.lost.verify_and_checkout(
            session.session_id, "att1", "spv1", "1234",
            "Budi", "3171010101010001", "evi_stnk", "evi_ktp",
        )
        self.assertEqual(out.state, SessionState.CHECKED_OUT)
        # total = 2h parking (3000) + lost ticket fine (20000)
        self.assertEqual(out.pricing.total_fee, 23000.0)
        self.assertEqual(out.pricing.lost_ticket_fee, 20000.0)


if __name__ == "__main__":
    unittest.main()
