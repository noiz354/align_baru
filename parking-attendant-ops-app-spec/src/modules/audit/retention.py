"""
Data Retention & Plate Masking (TASK-602 / ADR-004 / PRIVACY.md).

- Completed sessions without an open incident have their photo evidence purged
  after the retention window (default 30 days).
- Historical audit records have their plate strings masked (anonymized) once the
  retention window passes, satisfying UU PDP / GDPR.
- Sessions with an active incident (freeze_retention) are excluded until resolved.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from src.core.domain import GeoCoordinates  # noqa: F401 (kept for imports parity)
from src.infra.clock import MonotonicSystemClock


class PlateMaskingService:
    """Masks registration plates for historical / summary views (PRIVACY.md)."""

    @staticmethod
    def mask(plate: str) -> str:
        """Partial mask: keep region + first digit, hide the rest of the number.

        'B 1234 ABC' -> 'B 1*** ABC'
        """
        parts = plate.strip().split(" ")
        if len(parts) == 3:
            region, numbers, suffix = parts
            if numbers:
                masked = numbers[0] + ("*" * (len(numbers) - 1))
                return f"{region} {masked} {suffix}"
        # Fallback for non-standard plates.
        return plate[:3] + ("*" * max(1, len(plate) - 3))

    @staticmethod
    def mask_full(plate: str) -> str:
        """Aggressive mask for public monthly summaries (PRIVACY.md).

        'B 1234 ABC' -> 'B 1*** **G'  (region + first digit of number +
        last letter of suffix are kept; everything else masked).
        """
        parts = plate.strip().split(" ")
        if len(parts) == 3:
            region, numbers, suffix = parts
            masked_num = numbers[0] + ("*" * (len(numbers) - 1)) if numbers else "*"
            masked_suffix = ("*" * (len(suffix) - 1)) + suffix[-1] if suffix else "*"
            return f"{region} {masked_num} {masked_suffix}"
        return PlateMaskingService.mask(plate)


class RetentionRunner:
    def __init__(
        self,
        store,
        audit_logger=None,
        retention_days: int = 30,
        clock=None,
        delete_files: bool = False,
    ):
        self.store = store
        self.audit_logger = audit_logger
        self.retention_days = retention_days
        self.clock = clock or MonotonicSystemClock()
        self.delete_files = delete_files
        self.masker = PlateMaskingService()

    def run(self, now: Optional[datetime] = None) -> dict:
        now = now or self.clock.now()
        cutoff = now - timedelta(days=self.retention_days)

        photos = self.store.list_retained_photos_before(cutoff)
        photos_purged = 0
        for photo in photos:
            session = self.store.get_session(photo.session_id)
            # ADR-004: never purge evidence tied to an open incident.
            if session and session.has_active_incident:
                continue
            self.store.mark_photo_purged(photo.evidence_id)
            if self.delete_files and photo.file_path and os.path.exists(photo.file_path):
                try:
                    os.remove(photo.file_path)
                except OSError:
                    pass
            photos_purged += 1

        audit_plates_masked = 0
        if self.audit_logger is not None and hasattr(self.audit_logger, "anonymize_plates"):
            audit_plates_masked = self.audit_logger.anonymize_plates(self.masker)

        return {
            "photos_purged": photos_purged,
            "audit_plates_masked": audit_plates_masked,
            "cutoff": cutoff.isoformat(),
        }
