import os
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone

from src.core.domain import ParkingSlot, SlotStatus, VehicleType, Zone
from src.infra.clock import FakeClock
from src.infra.file_audit import JsonAuditLogger
from src.infra.sqlite_store import SqliteParkingStore
from src.modules.checkin.service import CheckInUseCase
from src.modules.checkout.service import CheckOutUseCase
from src.modules.shift.service import ShiftManagementUseCase


class TestCheckoutIdempotency(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp.name, "parking.sqlite")
        self.audit_path = os.path.join(self.tmp.name, "audit.jsonl")
        self.audit = JsonAuditLogger(self.audit_path)
        self.clock = FakeClock(datetime(2026, 9, 28, 8, 0, tzinfo=timezone.utc))
        store = SqliteParkingStore(self.db_path)
        store.save_zone(Zone("z1", "Zone", "facility-1"))
        store.save_slot(ParkingSlot("s1", "A-01", "z1", VehicleType.MOTORCYCLE, SlotStatus.EMPTY))
        self.shift = ShiftManagementUseCase(self.audit, shift_repo=store, clock=self.clock)
        self.shift.open_shift("sh1", "att1", "z1", 100_000, supervisor_id="supervisor")
        checkin = CheckInUseCase(store, self.audit, clock=self.clock)
        self.session = checkin.execute("B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "s1", "att1", "sh1")
        self.clock.advance(timedelta(hours=2))
        store.close()

    def tearDown(self):
        self.tmp.cleanup()

    def test_concurrent_and_replayed_checkout_payment_is_exactly_once(self):
        results = []
        errors = []
        result_lock = threading.Lock()

        def checkout_worker():
            repo = SqliteParkingStore(self.db_path)
            try:
                use_case = CheckOutUseCase(repo, self.audit, clock=self.clock, shift_repo=repo)
                result = use_case.execute(self.session.session_id, "att1", "CASH")
                with result_lock:
                    results.append(result)
            except Exception as exc:  # surfaced below with context
                with result_lock:
                    errors.append(f"{type(exc).__name__}: {exc}")
            finally:
                repo.close()

        threads = [threading.Thread(target=checkout_worker) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)
        self.assertTrue(all(not thread.is_alive() for thread in threads), "checkout thread timed out")
        self.assertEqual(errors, [])
        self.assertEqual(len(results), 2)

        # Simulate service restart/reconnect and duplicate checkout + payment retry.
        repo = SqliteParkingStore(self.db_path)
        reloaded_audit = JsonAuditLogger(self.audit_path)
        session = repo.get_session(self.session.session_id)
        payment_ids = (session.payment_id, session.receipt_id)
        replay = CheckOutUseCase(repo, reloaded_audit, clock=self.clock, shift_repo=repo).execute(
            self.session.session_id, "att1", "CASH"
        )
        self.assertEqual((replay.payment_id, replay.receipt_id), payment_ids)
        # Provider/payment retry hits the same durable unique session payment row.
        with repo.transaction(immediate=True):
            replay_payment_ids = repo.record_checkout_payment_receipt(
                self.session.session_id, "CASH", 3000.0, "PAID", session.check_out_time
            )
        self.assertEqual(replay_payment_ids, payment_ids)

        self.assertEqual(replay.state.value, "CHECKED_OUT")
        self.assertEqual(replay.pricing.total_fee, 3000.0)
        self.assertEqual(repo.get_slot("s1").status, SlotStatus.EMPTY)
        self.assertEqual(repo.get_shift("sh1").cash_collected_system, 3000.0)
        self.assertEqual(len(repo.list_checkout_payments(self.session.session_id)), 1)
        self.assertEqual(len(repo.list_receipts(self.session.session_id)), 1)
        entries = reloaded_audit.read_entries()
        self.assertEqual(sum(entry["action"] == "CHECK_OUT" for entry in entries), 1)
        self.assertTrue(reloaded_audit.verify_chain()[0], reloaded_audit.verify_chain()[1])

        # Reconciliation reflects exactly one 3,000 IDR cash fee.
        closed = ShiftManagementUseCase(reloaded_audit, shift_repo=repo, clock=self.clock).close_and_reconcile_shift(
            "sh1", actual_cash_counted=103_000.0, active_vehicles_count=0, supervisor_id="supervisor"
        )
        self.assertEqual(closed.cash_collected_system, 3000.0)
        self.assertEqual(closed.cash_variance, 0.0)
        self.assertTrue(reloaded_audit.verify_chain()[0], reloaded_audit.verify_chain()[1])
        repo.close()


if __name__ == "__main__":
    unittest.main()
