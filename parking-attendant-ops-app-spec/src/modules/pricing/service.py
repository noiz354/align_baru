"""
Pricing Engine Implementation: Deterministic duration calculation & rate evaluation.
Photos are purely evidence; calculation relies 100% on system timestamps (ADR-002).
"""

import math
from dataclasses import dataclass
from datetime import datetime
from src.core.domain import PricingBreakdown, VehicleType


@dataclass
class RateRule:
    vehicle_type: VehicleType
    grace_period_minutes: int
    initial_rate: float
    subsequent_rate: float
    daily_max_cap: float
    lost_ticket_fine: float


DEFAULT_RATES = {
    VehicleType.MOTORCYCLE: RateRule(
        vehicle_type=VehicleType.MOTORCYCLE,
        grace_period_minutes=5,
        initial_rate=2000.0,
        subsequent_rate=1000.0,
        daily_max_cap=20000.0,
        lost_ticket_fine=20000.0
    ),
    VehicleType.CAR: RateRule(
        vehicle_type=VehicleType.CAR,
        grace_period_minutes=5,
        initial_rate=5000.0,
        subsequent_rate=3000.0,
        daily_max_cap=50000.0,
        lost_ticket_fine=50000.0
    ),
    VehicleType.BICYCLE: RateRule(
        vehicle_type=VehicleType.BICYCLE,
        grace_period_minutes=10,
        initial_rate=1000.0,
        subsequent_rate=500.0,
        daily_max_cap=5000.0,
        lost_ticket_fine=10000.0
    ),
    VehicleType.TRUCK_HEAVY: RateRule(
        vehicle_type=VehicleType.TRUCK_HEAVY,
        grace_period_minutes=5,
        initial_rate=10000.0,
        subsequent_rate=8000.0,
        daily_max_cap=100000.0,
        lost_ticket_fine=100000.0
    )
}


class PricingEngine:
    @staticmethod
    def calculate(
        check_in_time: datetime,
        check_out_time: datetime,
        vehicle_type: VehicleType,
        is_lost_ticket: bool = False,
        is_waived: bool = False,
        custom_rate: RateRule = None
    ) -> PricingBreakdown:
        if is_waived:
            return PricingBreakdown(
                duration_minutes=0.0,
                billable_hours=0,
                base_fee=0.0,
                lost_ticket_fee=0.0,
                total_fee=0.0,
                is_grace_period=False,
                notes="OVERRIDE_WAIVED"
            )

        rate = custom_rate or DEFAULT_RATES.get(vehicle_type)
        if not rate:
            raise ValueError(f"Tarif tidak terdefinisi untuk tipe {vehicle_type}")

        duration_seconds = max(0.0, (check_out_time - check_in_time).total_seconds())
        duration_minutes = duration_seconds / 60.0

        # 1. Grace Period Check
        if duration_minutes <= rate.grace_period_minutes and not is_lost_ticket:
            return PricingBreakdown(
                duration_minutes=duration_minutes,
                billable_hours=0,
                base_fee=0.0,
                lost_ticket_fee=0.0,
                total_fee=0.0,
                is_grace_period=True,
                notes="GRACE_PERIOD_FREE"
            )

        # 2. Billable Hours (Ceiling to hour)
        billable_hours = math.ceil(duration_minutes / 60.0)
        if billable_hours <= 1:
            base_fee = rate.initial_rate
        else:
            base_fee = rate.initial_rate + ((billable_hours - 1) * rate.subsequent_rate)

        # 3. Daily Max Cap Application
        days = max(1, math.ceil(billable_hours / 24.0))
        max_cap = days * rate.daily_max_cap
        base_fee = min(base_fee, max_cap)

        # 4. Lost Ticket Fine
        lost_ticket_fee = rate.lost_ticket_fine if is_lost_ticket else 0.0

        total_fee = base_fee + lost_ticket_fee

        return PricingBreakdown(
            duration_minutes=duration_minutes,
            billable_hours=billable_hours,
            base_fee=base_fee,
            lost_ticket_fee=lost_ticket_fee,
            total_fee=total_fee,
            is_grace_period=False
        )
