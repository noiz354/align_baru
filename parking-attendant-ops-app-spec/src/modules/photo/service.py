"""
Photo Evidence & Watermark Envelope Service (TASK-302 / PHOTO-EVIDENCE.md).

Photos provide non-assumption observational records with tamper-evident
cryptographic hashes and a burn-in watermark binding plate, slot, time,
attendant and hash for legal forensics.
"""

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional

from src.core.domain import GeoCoordinates, PhotoEvidence


class PhotoEvidenceService:
    @staticmethod
    def capture_evidence(
        session_id: str,
        perspective: str,
        attendant_id: str,
        simulated_raw_bytes: bytes,
        simulated_file_path: str,
        geo: Optional[GeoCoordinates] = None,
        device_id: Optional[str] = None,
        clock=None,
    ) -> PhotoEvidence:
        """
        Creates an immutable photo evidence record bound to the session.
        `simulated_raw_bytes` stands in for the on-device compressed image bytes.
        """
        sha256_hash = hashlib.sha256(simulated_raw_bytes).hexdigest()
        now = (clock.now() if clock is not None else datetime.now(timezone.utc))

        evidence = PhotoEvidence(
            evidence_id=f"evi_{uuid.uuid4().hex[:10]}",
            session_id=session_id,
            perspective=perspective,
            file_path=simulated_file_path,
            hash_sha256=sha256_hash,
            captured_at=now,
            attendant_id=attendant_id,
            is_retained=True,
        )
        # Bind forensic geo/device metadata (PHOTO-EVIDENCE.md envelope).
        evidence.geo_lat = geo.latitude if geo else None
        evidence.geo_lon = geo.longitude if geo else None
        evidence.geo_acc = geo.accuracy_meters if geo else None
        evidence.device_id = device_id
        return evidence

    @staticmethod
    def generate_watermark_text(
        plate_display: str,
        slot_code: str,
        attendant_id: str,
        timestamp: datetime,
        hash_sha256: str,
    ) -> str:
        """
        Visual burn-in watermark text template (PHOTO-EVIDENCE.md).
        """
        time_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
        short_hash = hash_sha256[:12]
        return (
            f"PLAT: {plate_display} | SLOT: {slot_code} | "
            f"TIME: {time_str} | PETUGAS: {attendant_id} | HASH: {short_hash}"
        )
