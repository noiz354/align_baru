# Parking Attendant Operations App — MVP Implementation

Field-ops app for parking attendants: check-in / check-out, Indonesian plate
OCR sanitization, timestamp-based pricing, slot relocation, shift & cash
reconciliation, incident reporting, photo evidence with SHA-256 + burn-in
watermark, and privacy retention. Built **local-first** (offline-capable)
following the spec in this folder (`PRD.md`, `DOMAIN.md`, `ARCHITECTURE.md`,
`ADR-*.md`, `TASKS.md`).

## Stack
- **Python 3.11**, **zero runtime dependencies** (stdlib only: `sqlite3`,
  `hashlib`, `hmac`, `dataclasses`, `unittest`).
- Hexagonal / ports-and-adapters: domain core has no framework I/O.

## Layout
```
src/
  core/domain.py        Entities, enums, repository/clock ports (TASK-101)
  infra/
    clock.py            MonotonicSystemClock + FakeClock (ADR-002 / anti-tamper)
    sqlite_store.py     SQLite repo + migration runner + transactional wrapper (TASK-102/103)
    file_audit.py       Append-only JSON audit ledger (TASK-601)
    sync.py             Transactional outbox sync worker (OFFLINE.md)
  modules/
    vehicle/service.py  PlateSanitizer + quick observed-item tags (TASK-301/303)
    checkin/service.py  CheckInUseCase (TASK-203, clock)
    checkout/service.py CheckOutUseCase + mismatch + LostTicketVerification (TASK-402/403/404)
    parking/service.py  Slot state machine + MoveVehicle + nearest slot (TASK-201/202/203)
    pricing/service.py  PricingEngine (grace / progressive / daily cap / fine) (TASK-401)
    shift/service.py    Open / handover / reconcile (TASK-501/502/503)
    incident/service.py IncidentService + retention freeze (TASK-504)
    photo/service.py    PhotoEvidenceService SHA-256 + watermark (TASK-302)
    ticket/service.py   Signed QR manifest + ESC/POS 58mm receipt (TASK-304)
    audit/retention.py  PlateMaskingService + 30-day RetentionRunner (TASK-602)
    ocr/service.py      Mock edge OCR + Indonesian plate post-processing
tests/                  unittest suite (61 tests)
demo.py                 End-to-end field-ops walkthrough
```

## Run
```bash
# All tests (stdlib unittest, no install needed)
python3 -m unittest discover -s tests -p "test_*.py"

# End-to-end demo (writes to a temp dir, prints ticket/receipt/ledger)
python3 demo.py
```

## Key design decisions (per ADR)
- **ADR-002 / SECURITY**: pricing uses a monotonic, tamper-resistant clock; a
  rolled-back checkout time raises `ClockTamperError`.
- **ADR-003**: observed items are recorded as *visual observations*, never as
  bailment ("penitipan barang").
- **ADR-004 / ADR-005**: completed sessions' photos are purged after 30 days
  (frozen while an incident is open); historical audit plates are masked; lost
  tickets require STNK/KTP + supervisor PIN.
- **OFFLINE.md**: every mutation also writes an `outbox_events` row in the same
  SQLite transaction; `SyncEngineWorker` drains it when connectivity returns.
