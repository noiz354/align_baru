"""Shared test fixtures for the parking-ops test suite."""

from src.infra.sqlite_store import SqliteParkingStore
from src.core.domain import (
    ParkingSlot,
    SlotStatus,
    VehicleType,
    Zone,
)


def make_store() -> SqliteParkingStore:
    store = SqliteParkingStore(":memory:")
    store.save_zone(Zone(zone_id="z1", name="Zona Depan", facility_id="fac1"))
    slots = [
        ParkingSlot("s1", "A-01", "z1", VehicleType.MOTORCYCLE, SlotStatus.EMPTY, position_x=0, position_y=0),
        ParkingSlot("s2", "A-02", "z1", VehicleType.MOTORCYCLE, SlotStatus.EMPTY, position_x=5, position_y=0),
        ParkingSlot("s3", "C-01", "z1", VehicleType.CAR, SlotStatus.EMPTY, position_x=10, position_y=5),
        ParkingSlot("s4", "A-03", "z1", VehicleType.MOTORCYCLE, SlotStatus.RESERVED, position_x=2, position_y=2),
    ]
    for s in slots:
        store.save_slot(s)
    return store
