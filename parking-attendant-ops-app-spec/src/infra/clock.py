"""
Trusted system clock (ADR-002 / SECURITY.md).

The pricing engine must rely 100% on a system timestamp that cannot be gamed by
rolling the device clock backwards (e.g. to zero-out a relative's parking fee).
We anchor a monotonic hardware counter to a wall-clock reading and derive all
times from `time.monotonic()`, so any attempt to set the clock back is detected
as a negative elapsed delta.
"""

import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from src.core.domain import ClockTamperError, ISystemClock


class MonotonicSystemClock:
    """Concrete ISystemClock backed by a monotonic hardware counter.

    `now()` is wall_time(anchor) + (monotonic() - monotonic(anchor)). A backward
    jump in the underlying monotonic clock (which the OS kernel normally forbids,
    but which we still guard against) raises ClockTamperError.
    """

    def __init__(self, anchor: Optional[datetime] = None) -> None:
        self._anchor_wall = (anchor or datetime.now(timezone.utc))
        self._anchor_mono = time.monotonic()

    def now(self) -> datetime:
        elapsed = time.monotonic() - self._anchor_mono
        if elapsed < -1e-6:
            raise ClockTamperError(
                "Monotonic clock moved backwards; possible clock-skew tampering."
            )
        return self._anchor_wall + timedelta(seconds=elapsed)


class FakeClock:
    """Deterministic clock for tests and demos.

    Supports manual advancement so edge cases (midnight crossing, 0-second park,
    rolled-back clock) can be exercised deterministically.
    """

    def __init__(self, start: datetime) -> None:
        self._current = start if start.tzinfo else start.replace(tzinfo=timezone.utc)

    def now(self) -> datetime:
        return self._current

    def advance(self, delta: timedelta) -> "FakeClock":
        if delta < timedelta(0):
            raise ClockTamperError("FakeClock cannot be advanced backwards.")
        self._current = self._current + delta
        return self


def validate_non_decreasing(check_in: datetime, check_out: datetime) -> None:
    """Guard against an artificially rolled-back checkout time (jam mundur buatan)."""
    if check_out < check_in:
        raise ClockTamperError(
            f"Check-out time {check_out.isoformat()} precedes check-in "
            f"{check_in.isoformat()}; possible clock-skew tampering."
        )
