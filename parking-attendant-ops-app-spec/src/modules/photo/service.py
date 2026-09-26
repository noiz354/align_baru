"""
Photo Evidence & Watermark Envelope Service.
Photos provide non-assumption observational records with tamper-evident cryptographic hashes.
"""

import hashlib
import uuid
from datetime import datetime, timezone
from src.core.domain import PhotoEvidence


class PhotoEvidenceService:
    @staticmethod
    def capture_evidence(
        session_id: str,
        perspective: str,
        attendant_id: str,
        simulated_raw_bytes: bytes,
        simulated_file_path: str
    ) -> PhotoEvidence:
        """
        Creates an immutable photo evidence record bound to the session.
        """
        sha256_hash = hashlib.sha256(simulated_raw_bytes).hexdigest()
        now = datetime.now(timezone.utc)

        return PhotoEvidence(
            evidence_id=f"evi_{uuid.uuid4().hex[:10]}",
            session_id=session_id,
            perspective=perspective,
            file_path=simulated_file_path,
            hash_sha256=sha256_hash,
            captured_at=now,
            attendant_id=attendant_id,
            is_retained=True
        )

    @staticmethod
    def generate_watermark_text(
        plate_display: str,
        slot_code: str,
        attendant_id: str,
        timestamp: datetime,
        hash_sha256: str
    ) -> str:
        """
        Visual burn-in watermark text template.
        """
        time_str = timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")
        short_hash = hash_sha256[:12]
        return f"PLAT: {plate_display} | SLOT: {slot_code} | {time_str} | ID: {attendant_id} | HASH: {short_hash}"
