import unittest
from datetime import datetime, timezone, timedelta

from src.infra.clock import FakeClock, MonotonicSystemClock, validate_non_decreasing
from src.core.domain import ClockTamperError


class TestClock(unittest.TestCase):
    def test_fake_clock_advance(self):
        c = FakeClock(datetime(2026, 1, 1, tzinfo=timezone.utc))
        c.advance(timedelta(hours=2))
        self.assertEqual(c.now(), datetime(2026, 1, 1, 2, 0, 0, tzinfo=timezone.utc))

    def test_fake_clock_backwards_raises(self):
        c = FakeClock(datetime(2026, 1, 1, tzinfo=timezone.utc))
        with self.assertRaises(ClockTamperError):
            c.advance(timedelta(hours=-1))

    def test_validate_non_decreasing(self):
        t1 = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc)
        validate_non_decreasing(t1, t2)  # ok
        with self.assertRaises(ClockTamperError):
            validate_non_decreasing(t2, t1)

    def test_monotonic_clock_returns_aware_utc(self):
        c = MonotonicSystemClock()
        now = c.now()
        self.assertIsNotNone(now.tzinfo)


if __name__ == "__main__":
    unittest.main()
