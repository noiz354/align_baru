import unittest
import os
import tempfile
from datetime import datetime, timezone, timedelta

from tests.helpers import make_store
from src.infra.clock import FakeClock
from src.infra.file_audit import JsonAuditLogger
from src.modules.audit.service import InMemoryAuditLogger
from src.modules.audit.retention import RetentionRunner, PlateMaskingService
from src.modules.photo.service import PhotoEvidenceService
from src.core.domain import VehicleType, SessionState


class TestAuditLedger(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.path = os.path.join(self.tmp, "audit.jsonl")
        self.logger = JsonAuditLogger(self.path)

    def test_append_only(self):
        self.logger.record_audit("CHECK_IN", "SESSION", "ses_1", "att1", {"plate": "B 1234 ABC"})
        self.logger.record_audit("CHECK_OUT", "SESSION", "ses_1", "att1", {"plate": "B 1234 ABC"})
        entries = self.logger.read_entries()
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0]["action"], "CHECK_IN")
        self.assertGreater(entries[1]["seq"], entries[0]["seq"])


class TestRetention(unittest.TestCase):
    def setUp(self):
        self.store = make_store()
        self.now = datetime(2026, 9, 26, 12, 0, 0, tzinfo=timezone.utc)
        self.clock = FakeClock(self.now)
        self.tmp = tempfile.mkdtemp()
        self.audit_path = os.path.join(self.tmp, "audit.jsonl")
        self.audit = JsonAuditLogger(self.audit_path)
        self.audit.record_audit("CHECK_IN", "SESSION", "ses_old", "att1", {"plate": "B 1234 ABC"})

    def _seed_old_photo(self):
        from src.modules.checkin.service import CheckInUseCase
        from src.modules.audit.service import InMemoryAuditLogger
        checkin = CheckInUseCase(self.store, InMemoryAuditLogger(), clock=self.clock)
        sess = checkin.execute("B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1")
        # Force the captured-at time to 40 days ago to exceed retention.
        old = self.now - timedelta(days=40)
        ev = PhotoEvidenceService.capture_evidence(
            session_id=sess.session_id, perspective="FRONT", attendant_id="att1",
            simulated_raw_bytes=b"old", simulated_file_path="/evi/old.jpg", clock=self.clock,
        )
        ev.captured_at = old
        self.store.save_photo(ev)
        return sess, ev

    def test_purge_old_photo(self):
        sess, ev = self._seed_old_photo()
        runner = RetentionRunner(self.store, audit_logger=self.audit, retention_days=30, clock=self.clock)
        result = runner.run()
        self.assertEqual(result["photos_purged"], 1)
        reloaded = self.store.get_photo(ev.evidence_id)
        self.assertFalse(reloaded.is_retained)

    def test_freeze_on_active_incident(self):
        sess, ev = self._seed_old_photo()
        sess.has_active_incident = True
        self.store.save_session(sess)
        runner = RetentionRunner(self.store, audit_logger=self.audit, retention_days=30, clock=self.clock)
        result = runner.run()
        self.assertEqual(result["photos_purged"], 0)  # frozen, not purged
        self.assertTrue(self.store.get_photo(ev.evidence_id).is_retained)

    def test_mask_audit_plate(self):
        runner = RetentionRunner(self.store, audit_logger=self.audit, retention_days=30, clock=self.clock)
        result = runner.run()
        self.assertEqual(result["audit_plates_masked"], 1)
        entries = self.audit.read_entries()
        self.assertEqual(entries[0]["details"]["plate"], "B 1*** ABC")


class TestPlateMasking(unittest.TestCase):
    def test_partial_mask(self):
        self.assertEqual(PlateMaskingService.mask("B 1234 ABC"), "B 1*** ABC")

    def test_full_mask(self):
        # Keeps region, first digit of number, and last letter of suffix (PRIVACY.md).
        self.assertEqual(PlateMaskingService.mask_full("B 1234 ABC"), "B 1*** **C")


if __name__ == "__main__":
    unittest.main()
