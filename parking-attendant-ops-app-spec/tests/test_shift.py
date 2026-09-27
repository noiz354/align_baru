import unittest
from datetime import datetime, timezone, timedelta

from tests.helpers import make_store
from src.infra.clock import FakeClock
from src.modules.shift.service import ShiftManagementUseCase
from src.modules.checkin.service import CheckInUseCase
from src.modules.checkout.service import CheckOutUseCase
from src.modules.audit.service import InMemoryAuditLogger
from src.core.domain import VehicleType, ShiftStatus


class TestShiftReconciliation(unittest.TestCase):
    def setUp(self):
        self.store = make_store()
        self.start = datetime(2026, 9, 26, 6, 0, 0, tzinfo=timezone.utc)
        self.clock = FakeClock(self.start)
        self.audit = InMemoryAuditLogger()
        self.shift = ShiftManagementUseCase(
            self.audit, shift_repo=self.store, parking_repo=self.store, clock=self.clock
        )
        self.shift.open_shift("shf1", "att1", "z1", 100000.0)
        self.checkin = CheckInUseCase(self.store, self.audit, clock=self.clock)
        self.checkout = CheckOutUseCase(self.store, self.audit, clock=self.clock, shift_repo=self.store)

    def test_cash_collection_and_balanced(self):
        s = self.checkin.execute("B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1")
        self.clock.advance(timedelta(hours=2))
        self.checkout.execute(s.session_id, "att1", "CASH")
        closed = self.shift.close_and_reconcile_shift("shf1", actual_cash_counted=103000.0, active_vehicles_count=0)
        self.assertEqual(closed.cash_variance, 0.0)
        self.assertEqual(closed.status, ShiftStatus.CLOSED)

    def test_shortage(self):
        s = self.checkin.execute("B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1")
        self.clock.advance(timedelta(hours=2))
        self.checkout.execute(s.session_id, "att1", "CASH")
        closed = self.shift.close_and_reconcile_shift("shf1", actual_cash_counted=102000.0, active_vehicles_count=0)
        self.assertEqual(closed.cash_variance, -1000.0)  # shortage

    def test_approved_expenses(self):
        # float 100000, no collections, 5000 approved expense -> expected 95000
        closed = self.shift.close_and_reconcile_shift(
            "shf1", actual_cash_counted=95000.0, active_vehicles_count=0,
            approved_cash_expenses=5000.0,
        )
        self.assertEqual(closed.cash_variance, 0.0)

    def test_overage(self):
        closed = self.shift.close_and_reconcile_shift("shf1", actual_cash_counted=101000.0, active_vehicles_count=0)
        self.assertEqual(closed.cash_variance, 1000.0)  # overage

    def test_handover_inventory(self):
        self.checkin.execute("B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1")
        handover = self.shift.build_handover_inventory("shf1")
        self.assertEqual(len(handover.vehicle_inventory), 1)
        self.shift.confirm_handover(handover, "att2")
        self.assertTrue(handover.confirmed)
        self.assertEqual(handover.incoming_attendant_id, "att2")


if __name__ == "__main__":
    unittest.main()
