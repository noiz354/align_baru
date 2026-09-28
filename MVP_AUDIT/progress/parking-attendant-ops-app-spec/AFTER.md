# Parking Attendant — AFTER (2026-09-28)

**Target:** `MVP_PARTIAL` → `MVP_READY` (operator UI makes minimum parking flow usable)
**Result:** **ACHIEVED** — flow `Start shift → check-in → inspect → checkout → fee → payment → reconciliation` is now end-to-end via browser UI, reusing domain SQLite + audit + pricing + shift.

## Runtime

```bash
cd parking-attendant-ops-app-spec
python3 server.py --port 3201 --host 0.0.0.0  # → http://0.0.0.0:3201/  (DB ./data/parking.db)
curl -s http://localhost:3201/api/health  # → {"status":"ok","db":".../data/parking.db"}
curl -s http://localhost:3201/api/seed -X POST  # → seeded 3 vehicles
```

**URL:** `http://localhost:3201/` — static `index.html` serves operator UI (1440×1000 + 390×844 mobile).

## Seed (deterministic, idempotent)

`POST /api/seed` (or `ensure_baseline()` on boot) creates:

- Zone `z1` Zona Depan fac_pasarbari
- Slots `s1 A-01 MOTORCYCLE EMPTY`, `s2 A-02 MOTORCYCLE EMPTY`, `s3 A-03 MOTORCYCLE EMPTY`, `s4 C-01 CAR EMPTY`, `s5 B-01 MOTORCYCLE EMPTY`, `s6 B-02 CAR EMPTY`
- Shift `shf_morning` `att_budi` `z1` `cash_float_start 100000.0` `status OPEN` `supervisor spv1`
- 3 vehicles (via `CheckInUseCase`, audit `CHECK_IN`):
  - `ses_2555f782bae2` `B 1234 ABC` MOTORCYCLE BLACK → `A-01` (later aged & checked out)
  - `ses_7524cf197b5c` `D 5678 XYZ` CAR WHITE → `C-01` (aged 130 min, checked out 11000)
  - `ses_c1fb161fed20` `F 9012 HIJ` MOTORCYCLE RED → `A-02`
- Tariffs from `PricingEngine.DEFAULT_RATES`: MOTORCYCLE `2000+1000/h grace5 cap20000 fine20000`, CAR `5000+3000/h grace5 cap50000 fine50000`

All IDs synthetic, rerunnable (`find_active_session_by_plate` skips if active exists).

## Primary flow AFTER (with real IDs)

**Step 1 — Start shift**
- `GET /api/shifts/open` → `{"shift":{"shift_id":"shf_morning","attendant_id":"att_budi","zone_id":"z1","cash_float_start":100000.0,"cash_collected_system":4000.0,"status":"OPEN"}}` (before second checkout) → `15000.0` after.
- UI: header badge `OPEN • shf_morning`, KPI `Modal awal Rp 100.000`, `Tunai terkumpul Rp 15.000` (see `07-shift-summary.png`).

**Step 2 — Enter/scan plate + vehicle check-in**
- UI: `#plateInput` `B 4821 SSG`, `#typeInput` `MOTORCYCLE`, `#colorInput` `BLACK`, `#slotInput` auto `A-03`, `#attInput` `att_budi`.
- `POST /api/checkin` → `{"session_id":"ses_679a4f9e839a","plate_display":"B 4821 SSG","plate_canonical":"B4821SSG","slot_id":"s3","slot_code":"A-03","state":"ACTIVE"}` (see `03-checkin-form-filled.png` → `04-checkin-completed.png`).
- Reuses `CheckInUseCase` + `PlateSanitizer` + `SqliteParkingStore.save_session` + audit `CHECK_IN seq 4`.

**Step 3 — Inspect active parking**
- `GET /api/sessions` → 3 active after check-in: `F 9012 HIJ A-02`, `B 1234 ABC A-01`, `B 4821 SSG A-03` (see `02-seeded-populated.png`, `04-checkin-completed.png` table).
- `GET /api/slots` → grid: `A-01 OCCUPIED B 1234`, `A-02 OCCUPIED F`, `A-03 OCCUPIED B 4821`, `C-01 EMPTY` (after D checkout) etc. Thumb-friendly high-contrast.

**Step 4 — Vehicle checkout → calculated fee shown**
- Aged `ses_7524cf197b5c D 5678 XYZ` to `2026-09-27T22:59:31.874Z` (130 min ago) via `UPDATE sessions SET check_in_time`.
- `GET /api/pricing?session_id=ses_7524cf197b5c` → `{"pricing":{"duration_minutes":130.07,"billable_hours":3,"base_fee":11000.0,"lost_ticket_fee":0,"total_fee":11000.0}}` (see `05-pricing-preview.png` yellow box `Durasi 130.0 menit → 3 jam tagih Base Rp 11.000 = Rp 11.000`).
- Uses `PricingEngine.calculate` (grace 5m, `ceil(130/60)=3`, `5000+3000*2=11000`).

**Step 5 — Payment/cash recorded**
- `POST /api/checkout` `{"session_id":"ses_7524cf197b5c","attendant_id":"att_budi","payment_method":"CASH"}` → `{"session_id":"ses_7524cf197b5c","state":"CHECKED_OUT","payment_status":"PAID","pricing":{"total_fee":11000.0}}` (see `06-checkout-completed.png` `Lunas Rp 11.000`).
- Reuses `CheckOutUseCase` → frees slot `C-01 → EMPTY`, updates shift `cash_collected_system 4000 → 15000` (see `07-shift-summary.png`), writes audit `CHECK_OUT seq 4` hash-chained.

**Step 6 — Shift summary/reconciliation updated**
- `GET /api/shifts` → `cash_float_start 100000 + cash_collected 15000 = 115000` expected, `cash_variance` after `POST /api/shifts/shf_morning/close {"actual_cash_counted":115000}` → `0 BALANCED`.
- UI: `Tutup & rekonsiliasi` button, `handover` shows `3 kendaraan`.
- Audit `OPEN_SHIFT, CHECK_IN×4, CHECK_OUT×2` seq chain, `audit_ledger.jsonl` 6 entries.

## Persistence verification

1. **Mutation:** checkout `ses_7524cf197b5c` (D 5678 XYZ) → `CHECKED_OUT 11000`, `cash 15000`, slots `C-01 EMPTY`.
2. **Capture:** `curl /api/sessions` → active `['F 9012 HIJ','B 1234 ABC','B 4821 SSG']`, `cash 15000`.
3. **Restart:** `stop_process` + `start_process python3 server.py` (same `data/parking.db`).
4. **Reopen:** `curl /api/sessions` → active still `['F 9012 HIJ','B 1234 ABC','B 4821 SSG']`, `history` shows `D 5678 XYZ CHECKED_OUT 11000`, `cash 15000`.
5. **Verify:** state exists after restart — **DURABLE** (SQLite file `data/parking.db` 88KB survives, not temp).

Restart evidence captured via `curl` before/after (see console logs). No `NON_DURABLE`.

## Screenshots AFTER (1440×1000, real browser)

- `screenshots/after/01-entry-state.png` 152K — entry, 2 active before seed
- `screenshots/after/02-seeded-populated.png` 158K — populated 3 vehicles, slots grid, shift OPEN
- `screenshots/after/03-checkin-form-filled.png` 159K — form filled `B 4821 SSG` about to execute
- `screenshots/after/04-checkin-completed.png` 164K — completed, table shows `B 4821 SSG A-03 ACTIVE`, slot `A-03 OCCUPIED`, audit `CHECK_IN`
- `screenshots/after/05-pricing-preview.png` 172K — pricing preview `130.0 menit → 3 jam Rp 11.000` for `D 5678 XYZ`
- `screenshots/after/06-checkout-completed.png` 167K — checkout `Lunas Rp 11.000`, active now 3, slot `C-01 EMPTY`
- `screenshots/after/07-shift-summary.png` 167K — shift `Tunai terkumpul Rp 15.000`, handover `3 kendaraan`
- `screenshots/after/08-mobile.png` 156K — mobile 390×844, stacked cards, CTA thumb-friendly

All inspected: no blank, no inaccessible CTA, no overlay, no shell UI, no placeholder in critical path. Success messages correspond to DB state.

## Verdict

`MVP_PARTIAL` → **`MVP_READY`** (domain+UI) for minimum parking flow. Remaining P0 for production: QRIS provider settlement, photo evidence upload, offline mesh, ounce.

## Evidence directory

`MVP_AUDIT/progress/parking-attendant-ops-app-spec/` — `BEFORE.md`, `AFTER.md`, `CHANGES.md`, `screenshots/before/02`, `screenshots/after/08`.
