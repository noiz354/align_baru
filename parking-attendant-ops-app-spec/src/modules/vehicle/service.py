"""
Vehicle entity utilities and license plate sanitization rules.
"""

import re
from typing import List, Optional
from src.core.domain import ObservedItem, PlateNumber


# TASK-303: standardized quick-tag vocabulary for "Observasi Visual Barang
# Tertinggal" (pure visual observation, NOT bailment — see ADR-003 / DESIGN.md).
OBSERVED_ITEM_TYPES = ("HELMET", "JACKET", "BAG", "PACKAGE", "ACCESSORY")

# Common physical locations on a vehicle where an item is observed.
ITEM_LOCATIONS = (
    "MIRROR_HANG",      # helm di gantungan spion
    "FLOORBOARD",       # di lantai / pijakan kaki
    "SEAT",             # di atas jok
    "CARGO_BOX",        # dalam box / bagasi
    "REAR_RACK",        # di rak belakang
    "UNKNOWN",
)


class ObservedItemBuilder:
    """Builds ObservedItem records from quick-tap field tags (TASK-303)."""

    @classmethod
    def quick(cls, item_type: str, count: int = 1, location: str = "UNKNOWN",
              notes: Optional[str] = None) -> ObservedItem:
        item_type = item_type.upper()
        if item_type not in OBSERVED_ITEM_TYPES:
            raise ValueError(f"Tipe barang '{item_type}' tidak dikenal. Pilih dari {OBSERVED_ITEM_TYPES}.")
        if location.upper() not in ITEM_LOCATIONS:
            location = "UNKNOWN"
        return ObservedItem(
            item_type=item_type,
            count=count,
            location_on_vehicle=location,
            notes=notes,
        )

    @classmethod
    def helmet(cls, count: int = 1, location: str = "MIRROR_HANG") -> ObservedItem:
        return cls.quick("HELMET", count, location)

    @classmethod
    def bag(cls, count: int = 1, location: str = "SEAT") -> ObservedItem:
        return cls.quick("BAG", count, location)

    @classmethod
    def from_dict_list(cls, raw: List[dict]) -> List[ObservedItem]:
        return [
            cls.quick(
                item_type=d["item_type"],
                count=int(d.get("count", 1)),
                location=d.get("location", "UNKNOWN"),
                notes=d.get("notes"),
            )
            for d in raw
        ]


class PlateSanitizer:
    # Format plat nomor Indonesia standar: B 1234 ABC atau D 99 Z
    PLATE_REGEX = re.compile(r"^([A-Z]{1,2})\s*([0-9]{1,4})\s*([A-Z]{0,3})$")

    @classmethod
    def sanitize(cls, raw_input: str) -> PlateNumber:
        cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_input).upper()
        match = cls.PLATE_REGEX.match(cleaned)

        if not match:
            # Fallback jika format non-standar (misal plat dinas militer / diplomat)
            return PlateNumber(
                raw_value=raw_input,
                canonical=cleaned,
                display_format=cleaned
            )

        region, numbers, letters = match.groups()
        display = f"{region} {numbers} {letters}".strip()
        canonical = f"{region}{numbers}{letters}"

        return PlateNumber(
            raw_value=raw_input,
            canonical=canonical,
            display_format=display
        )


class VehicleWatchlistService:
    def check_watchlist(self, canonical_plate: str) -> Optional[dict]:
        """
        Check against operational watchlist (e.g. reported unpaid or police bulletin).
        """
        # MVP stub
        return None
