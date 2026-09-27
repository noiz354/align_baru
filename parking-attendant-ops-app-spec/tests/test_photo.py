import unittest
import hashlib

from src.modules.photo.service import PhotoEvidenceService
from src.core.domain import GeoCoordinates


class TestPhotoEvidence(unittest.TestCase):
    def test_sha256_hash(self):
        raw = b"fake-image-bytes-motorcycle-front"
        ev = PhotoEvidenceService.capture_evidence(
            session_id="ses_1", perspective="FRONT", attendant_id="att1",
            simulated_raw_bytes=raw, simulated_file_path="/evi/front.jpg",
        )
        self.assertEqual(ev.hash_sha256, hashlib.sha256(raw).hexdigest())
        self.assertTrue(ev.is_retained)

    def test_geo_and_device_binding(self):
        geo = GeoCoordinates(latitude=-6.2, longitude=106.8, accuracy_meters=5.0)
        ev = PhotoEvidenceService.capture_evidence(
            session_id="ses_1", perspective="REAR", attendant_id="att1",
            simulated_raw_bytes=b"x", simulated_file_path="/evi/rear.jpg",
            geo=geo, device_id="dev_01",
        )
        self.assertEqual(ev.geo_lat, -6.2)
        self.assertEqual(ev.device_id, "dev_01")

    def test_watermark_text(self):
        from datetime import datetime, timezone
        ts = datetime(2026, 9, 26, 9, 15, 30, tzinfo=timezone.utc)
        wm = PhotoEvidenceService.generate_watermark_text(
            "B 1234 ABC", "A-01", "att1", ts, "abcdef" * 4
        )
        self.assertIn("B 1234 ABC", wm)
        self.assertIn("A-01", wm)
        self.assertIn("att1", wm)
        self.assertIn("abcdef", wm)


if __name__ == "__main__":
    unittest.main()
