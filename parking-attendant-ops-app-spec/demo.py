#!/usr/bin/env python3
"""
End-to-end field-ops demo for the Parking Attendant Operations App.

Wires together every module from TASKS.md against the local-first SQLite store
and the append-only JSON audit ledger, walking a realistic attendant shift:

  open shift -> quick check-in (+photo +observed items +ticket)
  -> move vehicle -> check-out (cash) -> mismatch hold
  -> lost-ticket resolution -> incident report -> shift reconciliation
  -> data-retention run.

Run:  python3 demo.py
"""

import os
import tempfile
from datetime import datetime, timezone, timedelta

from src.infra.sqlite_store import SqliteParkingStore
from src.infra.clock import FakeClock
from src.infra.file_audit import JsonAuditLogger
from src.core.domain import (
    GeoCoordinates,
    IncidentCategory,
    PhotoEvidence,
    SlotStatus,
    VehicleType,
    Zone,
    ParkingSlot,
)

from src.modules.vehicle.service import PlateSanitizer, ObservedItemBuilder
from src.modules.checkin.service import CheckInUseCase
from src.modules.checkout.service import CheckOutUseCase, LostTicketVerificationUseCase
from src.modules.shift.service import ShiftManagementUseCase
from src.modules.parking.service import MoveVehicleUseCase, ParkingSlotService, SlotStateMachine
from src.modules.photo.service import PhotoEvidenceService
from src.modules.incident.service import IncidentService
from src.modules.ticket.service import QrTicketBuilder, EscPosReceiptBuilder
from src.modules.audit.retention import RetentionRunner

LINE = "=" * 60


def banner(title: str) -> None:
    print(f"\n{LINE}\n  {title}\n{LINE}")


def main() -> None:
    tmp = tempfile.mkdtemp(prefix="parking_demo_")
    db_path = os.path.join(tmp, "parking.db")
    audit_path = os.path.join(tmp, "audit_ledger.jsonl")

    store = SqliteParkingStore(db_path)
    audit = JsonAuditLogger(audit_path)
    clock = FakeClock(datetime(2026, 9, 26, 6, 0, 0, tzinfo=timezone.utc))

    # --- Facility / zone / slots ----------------------------------------
    store.save_zone(Zone("z1", "Zona Depan", "fac_pasarbari"))
    for i, (code, vtype, x, y) in enumerate([
        ("A-01", VehicleType.MOTORCYCLE, 0, 0),
        ("A-02", VehicleType.MOTORCYCLE, 4, 0),
        ("A-03", VehicleType.MOTORCYCLE, 8, 0),
        ("C-01", VehicleType.CAR, 0, 6),
    ]):
        store.save_slot(ParkingSlot(f"s{i+1}", code, "z1", vtype, SlotStatus.EMPTY, position_x=x, position_y=y))

    # --- Use cases ------------------------------------------------------
    shift_uc = ShiftManagementUseCase(audit, shift_repo=store, parking_repo=store, clock=clock)
    checkin_uc = CheckInUseCase(store, audit, clock=clock)
    checkout_uc = CheckOutUseCase(store, audit, clock=clock, shift_repo=store)
    move_uc = MoveVehicleUseCase(store, audit)
    slot_svc = ParkingSlotService(store)
    incident_uc = IncidentService(store, audit)
    qr = QrTicketBuilder(device_secret="demo-secret")
    lost_uc = LostTicketVerificationUseCase(store, audit, supervisor_pins={"spv1": "1234"}, clock=clock, shift_repo=store)

    # --- 1. Open shift --------------------------------------------------
    banner("1. BUKA SHIFT")
    shift = shift_uc.open_shift("shf_morning", "att_budi", "z1", cash_float_start=100000.0, supervisor_id="spv1")
    print(f"Shift {shift.shift_id} dibuka. Modal awal Rp {int(shift.cash_float_start):,}".replace(",", "."))

    # --- 2. Quick check-in ---------------------------------------------
    banner("2. QUICK CHECK-IN (motor + helm + foto)")
    nearest = slot_svc.find_nearest_empty_slot("z1", VehicleType.MOTORCYCLE, reference=(0, 0))
    plate = PlateSanitizer.sanitize("B 4821 SSG")
    observed = [ObservedItemBuilder.helmet(count=2, location="MIRROR_HANG"),
                ObservedItemBuilder.bag(location="SEAT")]
    photo_bytes = b"JPEG-LIKE-BYTES-front-bodi-motor"
    geo = GeoCoordinates(-6.21, 106.85, 4.0)
    evidence = PhotoEvidenceService.capture_evidence(
        session_id="", perspective="FRONT", attendant_id="att_budi",
        simulated_raw_bytes=photo_bytes, simulated_file_path=os.path.join(tmp, "evi_front.jpg"),
        geo=geo, device_id="dev_rugged_01", clock=clock,
    )
    session = checkin_uc.execute(
        raw_plate="b 4821 ssg", vehicle_type=VehicleType.MOTORCYCLE, color="BLACK",
        slot_id=nearest.slot_id, attendant_id="att_budi", shift_id=shift.shift_id,
        initial_notes="Baret tipis spakbor kiri", observed_items=observed, photos=[evidence],
    )
    evidence.session_id = session.session_id
    store.save_photo(evidence)
    print(f"Session {session.session_id} | Plat {plate.display_format} | Slot {nearest.slot_code}")
    print(f"Foto: SHA-256 {evidence.hash_sha256[:16]}... | GPS ({geo.latitude},{geo.longitude})")
    print(f"Observasi: Helm x2 (spion), Tas (jok)  [bukan penitipan barang]")

    # --- 3. Issue ticket (QR + ESC/POS) --------------------------------
    banner("3. TERBITKAN TIKET QR + STRUK THERMAL 58mm")
    payload = qr.build_payload(session, clock=clock)
    print("QR manifest:", payload)
    receipt = EscPosReceiptBuilder.build_receipt(session, None, "BUDI", payload)
    receipt_path = os.path.join(tmp, "receipt.bin")
    with open(receipt_path, "wb") as fh:
        fh.write(receipt)
    print(f"Struk ESC/POS ({len(receipt)} bytes) disimpan ke {receipt_path}")

    # --- 4. Move vehicle ------------------------------------------------
    banner("4. PINDAH KENDARAAN (reorganisasi)")
    target = slot_svc.find_nearest_empty_slot("z1", VehicleType.MOTORCYCLE, reference=(8, 0))
    move_uc.execute(session.session_id, target.slot_id, "att_budi", "REORGANIZATION")
    print(f"Dipindah ke slot {target.slot_code}. Status slot lama EMPTY.")

    # --- 5. Check-out (cash) -------------------------------------------
    banner("5. CHECK-OUT (tunai, 2 jam 10 menit)")
    clock.advance(timedelta(hours=2, minutes=10))
    out = checkout_uc.execute(session.session_id, "att_budi", "CASH")
    print(f"Durasi dibulatkan {out.pricing.billable_hours} jam -> Rp {int(out.pricing.total_fee):,}".replace(",", "."))
    print(f"Status sesi: {out.state.value} | Slot {target.slot_code} -> EMPTY")

    # --- 6. Mismatch hold ----------------------------------------------
    banner("6. MISMATCH HOLD (plat tidak cocok)")
    car_slot = slot_svc.find_nearest_empty_slot("z1", VehicleType.CAR, (0, 6))
    session2 = checkin_uc.execute("D 5678 XYZ", VehicleType.CAR, "WHITE", car_slot.slot_id, "att_budi", shift.shift_id)
    clock.advance(timedelta(hours=1))
    mism = checkout_uc.evaluate_mismatch(session2, "D 9999 ZZZ", "WHITE")
    if mism:
        checkout_uc.flag_mismatch(session2, "att_budi", "Plat tidak sesuai QR tiket")
        print(f"Mismatch terdeteksi -> sesi {session2.session_id} ditahan (UNDER_INVESTIGATION).")

    # --- 7. Lost ticket resolution -------------------------------------
    banner("7. TIKET HILANG (STNK+KTP + PIN supervisor)")
    lost_session = checkin_uc.execute("F 1234 HIJ", VehicleType.MOTORCYCLE, "RED", "s3", "att_budi", shift.shift_id)
    clock.advance(timedelta(hours=3))
    lost_out = lost_uc.verify_and_checkout(
        lost_session.session_id, "att_budi", "spv1", "1234",
        driver_name="Siti", driver_nik="3171010101010002",
        stnk_photo_evidence_id="evi_stnk", ktp_photo_evidence_id="evi_ktp",
    )
    print(f"Total (parkir + denda): Rp {int(lost_out.pricing.total_fee):,}".replace(",", "."))
    print(f"Denda tiket hilang: Rp {int(lost_out.pricing.lost_ticket_fee):,}".replace(",", "."))

    # --- 8. Incident report --------------------------------------------
    banner("8. LAPOR INSIDEN (motor roboh)")
    incident = incident_uc.report_incident(
        category=IncidentCategory.VEHICLE_DAMAGE,
        description="Motor Honda Beat miring, spion kanan retak.",
        attendant_id="att_budi", session_id=session2.session_id,
        photo_ids=["evi_inc_01"], severity="MEDIUM", supervisor_id="spv1",
    )
    print(f"Insiden {incident.incident_id} dicatat. Retensi foto di-freeze (active incident).")

    # --- 9. Shift reconciliation ---------------------------------------
    banner("9. TUTUP SHIFT & REKONSILIASI KAS")
    handover = shift_uc.build_handover_inventory(shift.shift_id)
    shift_uc.confirm_handover(handover, "att_sandi")
    # Physical cash count = float + system-collected cash (balanced scenario).
    live_shift = shift_uc.shift_repo.get_shift(shift.shift_id)
    expected_cash = live_shift.cash_float_start + live_shift.cash_collected_system
    closed = shift_uc.close_and_reconcile_shift(
        shift.shift_id, actual_cash_counted=expected_cash,
        active_vehicles_count=len(handover.vehicle_inventory),
    )
    print(f"Kas sistem terkumpul: Rp {int(live_shift.cash_collected_system):,}".replace(",", "."))
    print(f"Kas fisik dihitung  : Rp {int(closed.actual_cash_counted):,}".replace(",", "."))
    flag = ">>> SEIMBANG (BALANCED)" if closed.cash_variance == 0 else ">>> SELISIH (REVIEW)"
    print(f"Selisih kas         : Rp {int(closed.cash_variance):,}".replace(",", ".") + " " + flag)
    print(f"Serah terima kendaraan: {len(handover.vehicle_inventory)} unit (joint sign-off selesai).")

    # --- 10. Data retention run ----------------------------------------
    banner("10. RETENTION RUNNER (30 hari)")
    # Backdate the demo's photos to force purge of non-incident evidence.
    old = clock.now() - timedelta(days=40)
    for ph in store.list_photos(session.session_id):
        ph.captured_at = old
        store.save_photo(ph)
    result = RetentionRunner(store, audit_logger=audit, retention_days=30, clock=clock, delete_files=False).run()
    print(f"Foto di-purge: {result['photos_purged']} | Plat di-mask audit: {result['audit_plates_masked']}")

    banner("SELESAI")
    print(f"Audit ledger : {audit_path}")
    print(f"Database     : {db_path}")
    print(f"Total aksi teraudit: {len(audit.read_entries())}")


if __name__ == "__main__":
    main()
