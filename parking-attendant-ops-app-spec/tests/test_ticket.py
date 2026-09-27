import unittest

from src.modules.ticket.service import QrTicketBuilder, EscPosReceiptBuilder
from src.modules.checkin.service import CheckInUseCase
from src.modules.audit.service import InMemoryAuditLogger
from src.infra.clock import FakeClock
from src.core.domain import VehicleType
from tests.helpers import make_store
from datetime import datetime, timezone


class TestTicket(unittest.TestCase):
    def setUp(self):
        self.store = make_store()
        self.clock = FakeClock(datetime(2026, 9, 26, 9, 0, 0, tzinfo=timezone.utc))
        self.builder = QrTicketBuilder(device_secret="sec123")

    def test_qr_sign_verify_roundtrip(self):
        session = CheckInUseCase(self.store, InMemoryAuditLogger(), clock=self.clock).execute(
            "B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1"
        )
        payload = self.builder.build_payload(session, clock=self.clock)
        data = QrTicketBuilder.verify_payload(payload, device_secret="sec123")
        self.assertEqual(data["plate"], "B 1234 ABC")
        self.assertEqual(data["session_id"], session.session_id)

    def test_qr_tamper_detection(self):
        session = CheckInUseCase(self.store, InMemoryAuditLogger(), clock=self.clock).execute(
            "B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1"
        )
        payload = self.builder.build_payload(session, clock=self.clock)
        with self.assertRaises(ValueError):
            QrTicketBuilder.verify_payload(payload, device_secret="wrong-secret")

    def test_escpos_receipt(self):
        session = CheckInUseCase(self.store, InMemoryAuditLogger(), clock=self.clock).execute(
            "B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "shf1"
        )
        payload = self.builder.build_payload(session, clock=self.clock)
        from src.modules.pricing.service import PricingEngine
        pricing = PricingEngine.calculate(session.check_in_time, session.check_in_time, VehicleType.MOTORCYCLE)
        receipt = EscPosReceiptBuilder.build_receipt(session, pricing, "BUDI", payload)
        self.assertTrue(receipt.startswith(b"\x1b@"))   # ESC/POS init
        self.assertTrue(receipt.endswith(b"\x1dV\x00"))  # cut
        self.assertIn(b"B 1234 ABC", receipt)
        self.assertIn(b"BUDI", receipt)


if __name__ == "__main__":
    unittest.main()
