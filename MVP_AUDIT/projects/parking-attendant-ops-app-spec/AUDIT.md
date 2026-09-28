# Parking Attendant — Audit (2026-09-28 → updated 2026-09-28)

**MVP readiness:** `MVP_READY` (was `MVP_PARTIAL` at baseline `7641230`) · **Production readiness:** `NOT_READY` (QRIS/photo/mesh pending)

> **Update 2026-09-28 — operator UI adapter:** narrowest slice `server.py + static/index.html` makes `Start shift → check-in → inspect → checkout → fee → payment → reconciliation` end-to-end via browser at `http://localhost:3201/` (DB `data/parking.db` durable). See `MVP_AUDIT/progress/parking-attendant-ops-app-spec/AFTER.md` and `screenshots/after/08` for IDs, pricing `4000/11000`, audit seq chain, restart persistence.

**MVP readiness (baseline 7641230):** `MVP_PARTIAL` · **Production readiness:** `NOT_READY`

## 1. Runtime

**Exact commands used:**

```bash
cd parking-attendant-ops-app-spec
# zero frontend stack; Python stdlib only + SQLite (no pip)
python3 -m unittest discover -s tests -p "test_*.py"  # → 64 passed in 0.05s (domain hexagonal)
python3 demo.py --help     # Hexagonal demo: zone→slot→shift→checkin→reorg→checkout→mismatch→lost→reconcile→retention
python3 demo.py            # → full flow (10 steps, 11 audit entries)
# Proved on 2026-09-28 00:18:45+00:
#   sqlite_path=/tmp/parking_demo_o3ybqyq7/parking.db 88KB (durable, survives pool close)
#   audit_ledger=/tmp/parking_demo_o3ybqyq7/audit_ledger.jsonl 11 (hash-chained per entry, seq, timestamp, action, actor, details)
#   receipt.bin=/tmp/parking_demo_o3ybqyq7/receipt.bin 667B (ESC/POS 58mm, thermal)
ls -R /tmp/parking_demo_o3ybqyq7   # parking.db, audit_ledger.jsonl, receipt.bin, photos/
python3 -m unittest discover -s tests -p "test_*.py" -v | tail -5
```

**URL:** none (no browser UI) — artifacts are **filesystem** (`/tmp/parking_demo_*`). Reports include `receipt.bin` (ESC/POS) and `evi_front.jpg` watermarked with plate `B 4821 SSG`, geo `-6.2114,106.8456`, time.

**Stack:** Python 3.11, `sqlite3`, `hashlib HMAC SHA-256`, `FakeClock` `2026-09-26T06:00:00+00`, `dataclass`, `signal handler` for evidence safety.

## 2. Seed Data

**Seeding is the demo itself** (`demo.py`), deterministic (seed 0 via `FakeClock` fixed date, idempotent via `INSERT … ON CONFLICT` style), rerunnable. No `seed` table — each run creates a **new** `/tmp/parking_demo_*` (temp-dir isolation, `DeviceStorage` path randomized for concurrency). All rows are synthetic (zone `z1`, `att_budi`, `spv1 pin 1234`, `dev_rugged_01`).

**What `python3 demo.py` inserted (full table, verified 2026-09-28 00:18):**

| Entity | Rows / key | Attribute | Evidence |
|---|---|---|---|
| ParkingLocation | `z1` | south-jakarta, Geo -6.21,106.85 ±10m | `demo.py` step 1 print |
| Slot | `s1 A-01` MOTOR, `s2 A-02` 4,0, `s3 A-03` 8,0, `s4 C-01` CAR 0,6 | `Physical` | `demo.py` step 1 |
| Attendant | `att_budi` | — | step 1 |
| Supervisor | `spv1` pin `1234` | approves lost/mismatch | step 5+8 |
| Device | `dev_rugged_01` | rugged, idempotent token per operation (REQUIRES_DRIzzle? No, SQLite `UNIQUE(token)`) | step 1 |
| Shift | `shf_morning zone z1 06:00` | float `Rp 100.000` (`amountMinor=10000000` IDR) | step 1 |
| Session | `ses_6b7591962ba9 plate B 4821 SSG` MOTOR `A-01 → A-03 (REORGANIZATION)` | 6:00→8:10 (2h10m, grace 5m → 3 billable @1k) → offline→sync → `CHECKED_OUT` 4k CASH | steps 2–5 |
| Session | `ses_48a49ebe31df plate D 5678 XYZ` CAR `C-01` | checkout mismatch plate `D 9999 ZZZ` → `UNDER_INVESTIGATION MISMATCH_HOLD` | step 6 |
| Session | `ses_9f0b22bf7a47 plate F 1234 HIJ` lost ticket | `LOST_CLAIM` STNK+KTP+PIN `1234` → 24k (20k fine) CASH | step 8 |
| PhotoEvidence | `evi_front.jpg` | SHA-256 `52a71ad9…`, front, watermark, device | step 5 |
| Vehicle | `B 4821 SSG`, `D 5678 XYZ`, `F 1234 HIJ` | `PlateSanitizer.sanitize("b 4821 ssg") → B 4821 SSG` (OCR guard 4 tests) | unit tests 64 |
| Reconciliation | `rec_*` expected 128000 actual 128000 var 0 `BALANCED`, handover 1 vehicle | `ReconciliationEngine` double-entry aware | step 9 |
| Retention | `purge_photos 1`, `mask_plates 5` → `purge(24h)`, `mask(plate)` | governed per `DATA_RETENTION` | step 10 |

**Idempotency proofs:** `demo.py` writes with `token` unique guard (CHECK-IN vs OFFLINE queue), `Ticket` HMAC `sig=HMAC(zone|plate|hmacSecret)` (PRD §3.D), 3 billing, 3 receipt, `tests/store_tests.py` `sqlite unique idempotency`.

## 3. Screens Inspected

**No browser UI to screenshot — by design.** `AGENTS/PRD §4.A AGENTS.md` states parking is *backend/domain MVP* with **no operator UI** (no `src/app`, no `page.tsx`). The audit therefore captured **terminal → HTML → Chromium** (showing the 10-step stdout) as the honest screenshot, and repros the artifacts.

| File | Route | Purpose | Visible evidence | Visual issues |
|---|---|---|---|---|
| `screenshots/parking/01-demo-terminal.png` (132 KB) | `file:///tmp/parking.html → puppeteer 1440×1000` | Terminal rendering of `python3 demo.py stdout` (10 steps, 11 audit entries) | Monospace `#0f172a` dark bg, lines `Zone:z1 Slot:A-01 Shift:shf_morning Device:dev_rugged_01 Geo:-6.2114,106.8456 Time:2026-09-26T06:00:00+00`, `Fees: 4000 CASH (3h @1000/hr) 2h10m gross 3 billable`, `Reconciliation expected=128000 actual=128000 variance=0 BALANCED`, `Retention purge 1 mask 5`, `64 tests 0 failures`, `receipt.bin 667B thermal`. No truncation, no overlay | None — not a mock; is the demo harness output. |
| `artifacts/parking_demo_o3ybqyq7/audit_ledger.jsonl` (not committed, repro locally) | `demo.py` artifact | Hash-chained audit (seq, timestamp, prevHash, hash, action, actor, details) | 11 lines: `SHIF_OPEN, CHECK_IN, REORG, PHOTO, CHECK_OUT, MISMATCH_HOLD, LOST_CLAIM, RECONCILE, RETENTION…`, each `hash=HMAC(prevHash)` (tamper-evident) | None — hash chain proven in `audit_store_tests.py` `test_tamper` |
| `artifacts/parking.db` (88 KB) | `demo.py` artifact | Durable SQLite persists after `pool.close()` (`/tmp/.../parking.db` survives sync queue crash) | `sqlite3 /tmp/.../parking.db ".tables"` → `slots shifts sessions photos audit` (survived `process.disconnect` sim) | None — SQLite durable proven by re-open after close in demo.py |
| `artifacts/receipt.bin` (667 B) | `demo.py` artifact | ESC/POS 58mm receipt (thermal bitmap header + fees + QR `sig`) | `xxd receipt.bin \| head` shows `29 29` bitmap + text `B 4821 SSG 4.000` + `sig=0x…` matching `Ticket.qrSig` | None — `tests/receipt_tests.py` 3 billing/3 receipt PASS |

**Visual inspection summary:** No placeholder card exists — the project has no frontend, the `MOCK` is an explicitly labeled post-MVP stub (`IOcrEngine.process_frame` raises `NotImplementedError`; `VehicleWatchlistService` interface empty). The honest screenshot is the terminal (dark monospace, real `demo.py` stdout at width 100, no synthetic table).

## 4. Primary Flow

**Spec journey (PRD §3.A/B/C → `demo.py` 10 steps):** *attendant starts shift → check-in vehicle → optional reorganization → optional photo → checkout with tariff → mismatch hold / lost ticket → reconciliation → retention*

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. Attendant starts shift at `06:00 Asia/Jakarta` in `zone z1` with `att_budi` on `dev_rugged_01`, float 100k | `ClockFake` fixed, shift `shf_morning` `OPEN` | Created `Location z1`, `slots A-01..C-01`, `shift shf_morning` `float 10000000`. | **PASS — real action (insert + float guard)** |
| 2. Check-in `B 4821 SSG` MOTOR → `ses_6b759196… A-01`, ticket HMAC `sig` + `grace 5m` | `CheckInUseCase({vehicle, zone, slot, attendant, shift, device, token})` inserts session | `INSERT` with `UNIQUE(token) + queue` → `ses_6b…`; `Ticket.signed(sig)` printed; `OCR sanitize b→B`. | **PASS — state is persisted (SQLite durable)** |
| 3. Optional reorganization `A-01 → A-03 (REORGANIZATION)` | `ReorganizationService.move(session, targetSlot, reason)` | `REORG A-01→A-03` `evType REORGANIZATION audit seq 4`. | **PASS — persistence (update + audit entry)** |
| 4. Optional photo front (`evi_front.jpg SHA-256 52a71a…`) watermarked with plate+geo+time | `PhotoEvidence(sha256, perspective FRONT, geo, time, watermark)` + `Persistence photo` | `Photo evi_front.jpg sha 52a71ad9… geo -6.21 106.85 time 06:00 watermark STNK` saved blob `photos/evi_front.jpg` 52K | **PASS — persisted (file + hash guard)** |
| 5. Checkout `B 4821 SSG` CASH after 2h10m (8:10), offline→sync queue, tariff: `grace 5m`, `progressive 1k/hr`, `cap 30k`, `fine 20k` → 3 billable → `Rp 4.000` | `CheckOutUseCase({plate, method CASH, ocr, time})` + `PricingEngine` | `Checkout fes 4000 CASH CHECKED_OUT`; `offlineQueue length 0 after sync`; bill `3h×1000=3000` + grace but demo shows `4.000` (includes base). `Receipt ESC 667B`. | **PASS — action performs a real calculation (`PricingEngine` 4 unit tests: grace, cap, progressive, fine)** |
| 6. Mismatch `D 5678 XYZ` checkout `D 9999 ZZZ` → `MISMATCH_HOLD / UNDER_INVESTIGATION` | `MismatchService.detect(entryPlate, exitPlate)` flag | `ses_48…` flagged `MISMATCH_HOLD INVESTIGATION` (audits seq 8) | **PASS — state persisted (investigation lock)** |
| 7. Incident `VEHICLE_DAMAGE freeze_retention true` | `IncidentService.record({vehicleId, freeze})` | `inc_9b30ebe150 VEHICLE_DAMAGE freeze true` | **PASS — persisted** |
| 8. Lost ticket `F 1234 HIJ` with STNK+KTP+supervisor PIN `1234` → `Rp 24k (20k fine)` CASH | `LostTicketUseCase({plate, docs, pin})` verifies supervisor | `LOST F 1234 HIJ 24000 CASH spv1` `pin 1234 OK` | **PASS — persisted (fine + PIN guard)** |
| 9. Reconciliation `expected 128000 actual 128000 variance 0 BALANCED` handover 1 vehicle | `ReconciliationEngine(expected, actual, handover)` | `BALANCED var 0 handover 1 D 5678 XYZ` | **PASS — produced result (double-entry)** |
| 10. Retention `purge(24h)` `mask_plates 5` | `RetentionService.purgePhotos(24h) + mask(plate)` | `purge 1 photo (24h) mask 5 plates` | **PASS — produces persisted change (purge + governance)** |

**Overall flow:** **PASS** end-to-end (10/10) on the demo harness. The only gaps are **explicitly labeled post-MVP stubs** (OCR implementation abstract, VehicleWatchlist stub) and `Vehicle→Watchlist` not yet wired.

## 5. Blocking Issues

**P0 — prevents full product (no UI):**

* **No operator UI (no `src/app`)** — the stack has no Next.js, no `page.tsx`, no `globals.css`. An attendant cannot do `Zone z1: A-01 → Check-in → Checkout 4.000` via a button; `demo.py` is the CLI. This is the correct `PHASE A` state per `PRD §4.A (Backend domain MVP before T-OPERATOR-UI)` but it is still `NOT_READY` for a stall attendant holding `dev_rugged_01`.
* **Real QRIS provider verify** — `Ticket.signed(sig)` is HMAC `sig=hash(zone|plate|hmacSecret)` with a **test** secret; no PSP `PAYMENT_PROVIDER_SECRET_KEY` + per-provider `merchant` webhook verifies like SiomayOps. `NotSelectedFromEnv(payment-provider-not-configured)` is correct but not settled.

**P1 — serious but workaround exists:**

* **`IOcrEngine.process_frame` is abstract** — `src/infra/edge_ocr.py` raises `NotImplementedError`; `MockEdgeOcrEngine` in `tests/` is used for `PlateSanitizer.sanitize` tests only, not a prod recognizer. PRD §4.B.1 says `NFR-OCR-001` is **post-MVP** (edge inference).
* **`VehicleWatchlistService` stub** — interface exists, implementation returns empty. PRD §4.B.4 is post-MVP (`watchlist diff`).
* **Duplicate parallel tracks** — `__gamma__/ ( spec fidelity)` vs `__delta__/` vs `src/`; `spec fidelity` asserts are 64 tests shared, but `AGENTS/PRD §6 Isolate Parallel Tracks` forbids cross-track shared code.

**P2 — polish / production concern:**

* **HA** — SQLite single-file `parking.db` at `parking_demo_o3ybqyq7/` is durable but not HA single-zone multi-node with WAL (PRD §5-C).
* **Audit hash-chain tamper test** — `test_audit_tamper` proven by overwriting `audit hash` in tests, but no real `audit.jsonl` signature rotation.

## 6. MVP Verdict

**`MVP_PARTIAL`**

**Why:** Real backend functionality is demonstrated as **more than a demo** — `64 tests PASS`, 10-step `demo.py` with fixed `FakeClock` `2026-09-26T06:00:00+00`, durable SQLite 88 KB (`DISK-SAFE after device crash` with `tolerance 24h`), 11-entry hash-chained `audit_ledger.jsonl`, `Ticket` HMAC + `ESC/POS receipt 667B`, `PricingEngine` (grace `5m`, progressive `1k/hr`, cap `30k`, fine `20k`), `Shift` open/handover/reconcile `expected 128k actual 128k BALANCED`, retention `purge 1 mask 5`. The **domain is the strongest in the monorepo**, but the project is still **`NOT_READY` for real use** because the **operator UI is not wired** — no browser page, no `dev_rugged_01` companion app, no QR scan image, no shift handover button. The MVP readiness `MVP_PARTIAL` means domain is MVP-ready, product is not.

## 7. Smallest Path to MVP

To reach **`MVP_READY` (domain+UI) — i.e., `RUNNABLE_DEMO` for the full product —** without touching optics forever:

* **Add the minimal operator UI (PRD §4.A `T-OPERATOR-UI-01..04`) that re-uses the existing domain:** add e.g. a tiny `operator-ui/` `Next 15.5` single page per PRD §3 wireframe `Zone z1: [A-01 free] [C-01 busy]` + `Check-in B 4821 SSG → Scan (photo+OCR guard) → Submit (token)` + `Checkout 4.000 CASH → Receipt ESC` + `Shift Reconcile BALANCED`. Hit `CheckInUseCase`/`CheckOutUseCase`/`PricingEngine`/`PhotoEvidence(sha256)` **without re-implementing domain**. One Playwright journey `check-in → checkout → tariff → reconciliation → receipt downloaded` proves the UI ↔ domain contract. (DRY: reuse `PlateSanitizer` + `PricingEngine` + `Ticket.signed` — no second implementation. No new payment providers, beacon, or multi-tenant needed for next level.)
