import unittest
from datetime import datetime, timezone, timedelta

from src.modules.pricing.service import PricingEngine, DEFAULT_RATES
from src.core.domain import VehicleType


class TestPricingEngine(unittest.TestCase):
    def setUp(self):
        self.base = datetime(2026, 9, 26, 9, 0, 0, tzinfo=timezone.utc)

    def _calc(self, minutes, vtype=VehicleType.MOTORCYCLE, **kw):
        out = self.base + timedelta(minutes=minutes)
        return PricingEngine.calculate(self.base, out, vtype, **kw)

    def test_grace_period_free(self):
        b = self._calc(3)
        self.assertTrue(b.is_grace_period)
        self.assertEqual(b.total_fee, 0.0)

    def test_zero_second_park(self):
        b = PricingEngine.calculate(self.base, self.base, VehicleType.MOTORCYCLE)
        self.assertEqual(b.total_fee, 0.0)

    def test_first_hour_flat(self):
        b = self._calc(60)
        self.assertEqual(b.billable_hours, 1)
        self.assertEqual(b.total_fee, 2000.0)

    def test_progressive_second_hour(self):
        b = self._calc(90)  # ceiling -> 2 hours
        self.assertEqual(b.billable_hours, 2)
        self.assertEqual(b.total_fee, 2000.0 + 1000.0)

    def test_daily_max_cap(self):
        # Exactly 24h: base 2000 + 23*1000 = 25000, capped to single-day 20000.
        b = self._calc(24 * 60)
        self.assertEqual(b.billable_hours, 24)
        self.assertEqual(b.total_fee, 20000.0)

        # 30h spans into a 2nd day -> cap becomes 2 * daily_max_cap = 40000,
        # base 31000 stays under it.
        b2 = self._calc(30 * 60)
        self.assertEqual(b2.billable_hours, 30)
        self.assertEqual(b2.total_fee, 31000.0)
        self.assertLessEqual(b2.total_fee, 2 * DEFAULT_RATES[VehicleType.MOTORCYCLE].daily_max_cap)

    def test_lost_ticket_fine(self):
        b = self._calc(60, is_lost_ticket=True)
        self.assertEqual(b.total_fee, 2000.0 + 20000.0)
        self.assertEqual(b.lost_ticket_fee, 20000.0)

    def test_waived(self):
        b = self._calc(600, is_waived=True)
        self.assertEqual(b.total_fee, 0.0)
        self.assertEqual(b.notes, "OVERRIDE_WAIVED")

    def test_midnight_crossing(self):
        # 23:00 -> 01:00 next day = 120 minutes -> 2 hours
        start = datetime(2026, 9, 26, 23, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 9, 27, 1, 0, 0, tzinfo=timezone.utc)
        b = PricingEngine.calculate(start, end, VehicleType.MOTORCYCLE)
        self.assertEqual(b.billable_hours, 2)
        self.assertEqual(b.total_fee, 3000.0)

    def test_car_rate(self):
        b = self._calc(60, VehicleType.CAR)
        self.assertEqual(b.total_fee, 5000.0)


if __name__ == "__main__":
    unittest.main()
