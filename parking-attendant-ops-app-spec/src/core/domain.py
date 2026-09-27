"""
Core domain entities, value objects, and repository interfaces.
Clean domain layer with no direct external framework dependencies.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Protocol, Dict, Any


class VehicleType(str, Enum):
    MOTORCYCLE = "MOTORCYCLE"
    CAR = "CAR"
    BICYCLE = "BICYCLE"
    TRUCK_HEAVY = "TRUCK_HEAVY"


class SlotStatus(str, Enum):
    EMPTY = "EMPTY"
    OCCUPIED = "OCCUPIED"
    RESERVED = "RESERVED"
    BLOCKED = "BLOCKED"


class SessionState(str, Enum):
    ACTIVE = "ACTIVE"
    CHECKED_OUT = "CHECKED_OUT"
    OVERSTAY = "OVERSTAY"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, Enum):
    UNPAID = "UNPAID"
    PAID = "PAID"
    OVERRIDE_WAIVED = "OVERRIDE_WAIVED"


class ShiftStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class IncidentCategory(str, Enum):
    VEHICLE_DAMAGE = "VEHICLE_DAMAGE"
    PROPERTY_LOSS = "PROPERTY_LOSS"
    DISPUTE_ALTERCATION = "DISPUTE_ALTERCATION"
    IMMOBILIZED_VEHICLE = "IMMOBILIZED_VEHICLE"
    GATE_RUNNER = "GATE_RUNNER"


@dataclass(frozen=True)
class PlateNumber:
    raw_value: str
    canonical: str
    display_format: str


@dataclass
class ObservedItem:
    item_type: str  # HELMET, JACKET, BAG, PACKAGE, ACCESSORY
    count: int
    location_on_vehicle: str
    notes: Optional[str] = None


@dataclass
class PhotoEvidence:
    evidence_id: str
    session_id: str
    perspective: str  # FRONT, REAR, SIDE, DETAIL
    file_path: str
    hash_sha256: str
    captured_at: datetime
    attendant_id: str
    is_retained: bool = True


@dataclass
class PricingBreakdown:
    duration_minutes: float
    billable_hours: int
    base_fee: float
    lost_ticket_fee: float
    total_fee: float
    is_grace_period: bool = False
    notes: Optional[str] = None


@dataclass
class GeoCoordinates:
    latitude: float
    longitude: float
    accuracy_meters: float = 0.0


@dataclass
class ParkingSlot:
    slot_id: str
    slot_code: str
    zone_id: str
    allowed_type: VehicleType
    status: SlotStatus
    current_session_id: Optional[str] = None
    # Relative layout coordinates for "nearest empty slot" recommendation (TASK-202).
    position_x: float = 0.0
    position_y: float = 0.0


@dataclass
class Zone:
    zone_id: str
    name: str
    facility_id: str = ""
    position_x: float = 0.0
    position_y: float = 0.0


@dataclass
class ParkingSession:
    session_id: str
    plate_number: PlateNumber
    vehicle_type: VehicleType
    color: str
    slot_id: str
    check_in_time: datetime
    check_in_attendant_id: str
    shift_id: str
    state: SessionState
    initial_condition_notes: str
    observed_items: List[ObservedItem] = field(default_factory=list)
    photos: List[PhotoEvidence] = field(default_factory=list)
    check_out_time: Optional[datetime] = None
    check_out_attendant_id: Optional[str] = None
    pricing: Optional[PricingBreakdown] = None
    payment_status: PaymentStatus = PaymentStatus.UNPAID
    has_active_incident: bool = False


# Repository Interfaces (Ports)
class IParkingRepository(Protocol):
    def get_slot(self, slot_id: str) -> Optional[ParkingSlot]: ...
    def save_slot(self, slot: ParkingSlot) -> None: ...
    def list_empty_slots(self, zone_id: str, vehicle_type: VehicleType) -> List[ParkingSlot]: ...
    
    def save_session(self, session: ParkingSession) -> None: ...
    def get_session(self, session_id: str) -> Optional[ParkingSession]: ...
    def find_active_session_by_plate(self, canonical_plate: str) -> Optional[ParkingSession]: ...
    def list_active_sessions(self, zone_id: Optional[str] = None) -> List[ParkingSession]: ...


class IAuditLogPort(Protocol):
    def record_audit(self, action: str, entity_type: str, entity_id: str, actor_id: str, details: Dict[str, Any]) -> None: ...


class ISystemClock(Protocol):
    """Trusted time source (ADR-002 / SECURITY).

    Implementations must derive time from a monotonic hardware counter so that
    an attendant cannot roll the device clock backwards to zero-out parking
    duration. `now()` always returns an aware UTC datetime.
    """

    def now(self) -> datetime: ...


class IShiftRepository(Protocol):
    """Persistence port for shift records (TASK-102 / TASK-501)."""

    def save_shift(self, shift: Any) -> None: ...
    def get_shift(self, shift_id: str) -> Optional[Any]: ...


class ClockTamperError(RuntimeError):
    """Raised when a non-monotonic (clock-skew / rolled-back) timestamp is detected."""
