# Parking Attendant — CHANGES

**Scope:** narrowest vertical slice removing `P0 No operator UI`. No domain rewrite; pure adapter reusing pricing, store, audit, receipt, shifts.

## New files

- `parking-attendant-ops-app-spec/server.py` (380 lines, stdlib `http.server`, no Flask) — reuses `SqliteParkingStore(data/parking.db)`, `JsonAuditLogger(data/audit_ledger.jsonl)`, `MonotonicSystemClock`, `CheckInUseCase`, `CheckOutUseCase`, `ShiftManagementUseCase`, `ParkingSlotService`, `MoveVehicleUseCase`, `PricingEngine`. Endpoints: `GET /`, `/api/health|zones|slots|sessions|shifts|pricing|tariffs|audit`, `POST /api/shifts/open|checkin|checkout|move|seed|handover|close`. Serves `static/index.html`. Persistent `data/` (88KB SQLite).

- `parking-attendant-ops-app-spec/static/index.html` (280 lines, thumb-friendly, high-contrast `#0f172a`→`#1e293b`, large touch targets, one-hand ergonomics) — sections: Shift KPIs, Check-in form (plate, type, color, slot, attendant), Slots grid (EMPTY green `#052e1b` / OCCUPIED red `#3b0a0a`), Active table (plate, slot, actions Tarif/Checkout), Checkout preview (duration→fee), Audit 5 latest, Tariffs, Handover. JS `fetch` with `Idempotency` via `slot_id` guard.

## Modified files

- None modified in `src/` (domain untouched). `data/` is new runtime artifact (git-ignored but required for persistence; committed evidence shows `data/parking.db` exists).

## Reused domain (not reimplemented)

- `src/infra/sqlite_store.py` `SqliteParkingStore` (schema_migrations, zones, slots, sessions, photos, shifts, incidents, outbox, transaction wrapper)
- `src/infra/file_audit.py` `JsonAuditLogger` (hash-chained, tamper-evident)
- `src/infra/clock.py` `MonotonicSystemClock` + `validate_non_decreasing`
- `src/core/domain.py` entities + `VehicleType, SlotStatus, SessionState, PaymentStatus, ShiftStatus`
- `src/modules/checkin/service.py` `CheckInUseCase` (plate sanitize, slot EMPTY invariant, outbox, audit)
- `src/modules/checkout/service.py` `CheckOutUseCase` + `LostTicketVerificationUseCase` (PricingEngine, QRIS guard, slot free, shift cash, audit)
- `src/modules/parking/service.py` `ParkingSlotService.find_nearest_empty_slot`, `MoveVehicleUseCase`
- `src/modules/pricing/service.py` `PricingEngine.calculate` (grace 5m, `ceil`, cap, fine)
- `src/modules/vehicle/service.py` `PlateSanitizer`
- `tests` still 64 passed (no domain change).

## Seed

- `POST /api/seed` idempotent: `Zone z1`, 6 slots, `shf_morning 100000 OPEN`, 3 vehicles `B 1234 ABC`, `D 5678 XYZ`, `F 9012 HIJ` (via CheckInUseCase, so audit seq chain).

## Evidence

- `MVP_AUDIT/progress/parking-attendant-ops-app-spec/BEFORE.md` — reproduces no UI (terminal, curl refused)
- `MVP_AUDIT/progress/parking-attendant-ops-app-spec/AFTER.md` — flow with IDs, pricing 4000/11000, audit seq, persistence restart
- `MVP_AUDIT/progress/parking-attendant-ops-app-spec/CHANGES.md` — this file
- `screenshots/before/01-demo-terminal.png 132K`, `02-no-ui-files.png 41K`
- `screenshots/after/01-entry-state.png 152K … 08-mobile.png 156K` (8 real browser screenshots, 1440×1000 + mobile)

## Ignored / not done (roadmap intact)

- No `T-OCR`, no QRIS provider, no photo upload, no watchlist, no multi-node mesh, no ESC/POS transport (builder exists but not wired), no change to `TASKS.md` beyond UI; no `Not implemented` replaced except via adapter.

## Commit

`feat(parking): advance MVP from MVP_PARTIAL toward MVP_READY — operator UI adapter` (next)
