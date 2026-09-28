#!/usr/bin/env python3
"""Runtime proof: duplicate/concurrent checkout + payment is exactly once."""
from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.domain import ParkingSlot, SlotStatus, VehicleType, Zone
from src.infra.clock import FakeClock
from src.infra.file_audit import JsonAuditLogger
from src.infra.sqlite_store import SqliteParkingStore
from src.modules.checkin.service import CheckInUseCase
from src.modules.checkout.service import CheckOutUseCase
from src.modules.shift.service import ShiftManagementUseCase


def main():
    with tempfile.TemporaryDirectory(prefix="parking-wave3-") as tmp:
        db_path = Path(tmp) / "parking.sqlite"
        audit_path = Path(tmp) / "audit.jsonl"
        audit = JsonAuditLogger(str(audit_path))
        clock = FakeClock(datetime(2026, 9, 28, 8, 0, tzinfo=timezone.utc))
        seed = SqliteParkingStore(str(db_path))
        seed.save_zone(Zone("zone-wave3", "Wave3", "facility-wave3"))
        seed.save_slot(ParkingSlot("slot-wave3", "A-01", "zone-wave3", VehicleType.MOTORCYCLE, SlotStatus.EMPTY))
        ShiftManagementUseCase(audit, shift_repo=seed, clock=clock).open_shift(
            "shift-wave3", "att-wave3", "zone-wave3", 100_000, supervisor_id="sup-wave3"
        )
        session = CheckInUseCase(seed, audit, clock=clock).execute(
            "B 1234 ABC", VehicleType.MOTORCYCLE, "BLACK", "slot-wave3", "att-wave3", "shift-wave3"
        )
        session_id = session.session_id
        clock.advance(timedelta(hours=2))
        seed.close()

        responses, errors = [], []
        lock = threading.Lock()

        def request_checkout():
            repo = SqliteParkingStore(str(db_path))
            try:
                result = CheckOutUseCase(repo, audit, clock=clock, shift_repo=repo).execute(
                    session_id, "att-wave3", "CASH"
                )
                with lock:
                    responses.append(result)
            except Exception as exc:
                with lock:
                    errors.append(f"{type(exc).__name__}: {exc}")
            finally:
                repo.close()

        threads = [threading.Thread(target=request_checkout) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)
        if any(thread.is_alive() for thread in threads):
            raise RuntimeError("concurrent checkout timed out")
        if errors or len(responses) != 2:
            raise RuntimeError(f"checkout calls failed: {errors}")

        # Restart/reopen: replay same checkout and the same logical payment.
        repo = SqliteParkingStore(str(db_path))
        audit_after_restart = JsonAuditLogger(str(audit_path))
        reloaded = repo.get_session(session_id)
        payment_ids_before = (reloaded.payment_id, reloaded.receipt_id)
        duplicate_checkout = CheckOutUseCase(repo, audit_after_restart, clock=clock, shift_repo=repo).execute(
            session_id, "att-wave3", "CASH"
        )
        with repo.transaction(immediate=True):
            duplicate_payment_ids = repo.record_checkout_payment_receipt(
                session_id, "CASH", 3000.0, "PAID", reloaded.check_out_time
            )

        payment_rows = repo.list_checkout_payments(session_id)
        receipt_rows = repo.list_receipts(session_id)
        shift_before_reconcile = repo.get_shift("shift-wave3")
        checkout_audits = [e for e in audit_after_restart.read_entries() if e["action"] == "CHECK_OUT"]
        outbox_count = repo._conn.execute(
            "SELECT COUNT(*) AS n FROM outbox_events WHERE event_type='VehicleCheckedOut' AND payload LIKE ?",
            (f"%{session_id}%",),
        ).fetchone()["n"]

        closed = ShiftManagementUseCase(audit_after_restart, shift_repo=repo, clock=clock).close_and_reconcile_shift(
            "shift-wave3", actual_cash_counted=103_000.0, active_vehicles_count=0,
            supervisor_id="sup-wave3",
        )
        chain_valid, chain_issues = audit_after_restart.verify_chain()
        proof = {
            "scenario": "same checkout replay + 2 concurrent duplicate checkout requests + payment retry + reopen/reconciliation",
            "session_id": session_id,
            "concurrent_checkout_requests": 2,
            "concurrent_successes": len(responses),
            "concurrent_errors": errors,
            "checkout_state": duplicate_checkout.state.value,
            "fee": duplicate_checkout.pricing.total_fee,
            "payment_method": duplicate_checkout.checkout_payment_method,
            "payment_id": payment_ids_before[0],
            "payment_retry_id": duplicate_payment_ids[0],
            "receipt_id": payment_ids_before[1],
            "receipt_retry_id": duplicate_payment_ids[1],
            "payments_for_session": len(payment_rows),
            "receipts_for_session": len(receipt_rows),
            "checkout_audit_events": len(checkout_audits),
            "checkout_outbox_events": outbox_count,
            "shift_cash_before_reconcile": shift_before_reconcile.cash_collected_system,
            "cash_expected_after_reconcile": closed.cash_float_start + closed.cash_collected_system,
            "cash_counted": closed.actual_cash_counted,
            "cash_variance": closed.cash_variance,
            "audit_events_after_reconcile": len(audit_after_restart.read_entries()),
            "audit_chain_valid": chain_valid,
            "audit_chain_issues": chain_issues,
        }
        repo.close()
        if not chain_valid or payment_ids_before != duplicate_payment_ids or len(payment_rows) != 1 or len(receipt_rows) != 1:
            raise AssertionError(json.dumps(proof, indent=2))
        if closed.cash_variance != 0.0 or outbox_count != 1 or len(checkout_audits) != 1:
            raise AssertionError(json.dumps(proof, indent=2))
        print(json.dumps(proof, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
