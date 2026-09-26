"""
Vehicle entity utilities and license plate sanitization rules.
"""

import re
from typing import Optional
from src.core.domain import PlateNumber


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
