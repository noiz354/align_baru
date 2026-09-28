# Seed Data — Deterministic Demo / Dev Fixtures

All seed is **demo/development-only**, synthetic, idempotent where practical, and contains no real credentials. See `RUNTIME_COMMANDS.md` for the exact commands. Screenshots were taken **without** a live Postgres for the 4 PG projects — so catalog/event/sales data is the *shell* state, not the seeded state. This file describes **what the existing seed harness would create once a PG is provisioned**, and what *was* actually used for this audit.

## HomeOps (`homeops-household-manager-spec`) — `src/server/db/seed/{fixtures.ts,run.ts}` + `scripts/seed.ts`

**Guard:** `DATABASE_URL` must contain `dev|test|local` in the database name and host must not look like `prod|production`; otherwise `seed: refused`. `SEED_INSTANT` is fixed `2026-01-05T00:00:00.000Z` (no wall-clock dependency). Idempotent: `INSERT … ON CONFLICT DO NOTHING` + literal `seedId(n)` = `00000000-0000-4000-8000-00000000xxxx`.

**What `seedDevelopmentData({})` (identity & tenancy only) inserts today — verified in `fixtures.ts`:**

| Household | Timezone | WeekStartsOn | Owner | Members (Role, Away) |
|---|---|---|---|---|
| `HH_MAIN` `00000000-0000-4000-8000-000000000001` | `Asia/Jakarta` | MONDAY | `Sari` (`seed-user-hh-main-sari` / `101`) OWNER | `Budi` ADMIN `102`, `Dita` MEMBER `103`, `Andi` HELPER `104` away `2026-01-05→12` |
| `HH_CONTROL` `…0002` | `America/New_York` | SUNDAY | `Nora` `201` OWNER | `Felix` `202` ADMIN, `Maya` `203` MEMBER, `Jonas` `204` HELPER |
| `HH_WIDTH` `…0003` | `Europe/Berlin` | MONDAY | `Leni` `301` OWNER | `Tomas` `302` ADMIN |
| `HH_WIDTH_SOUTH` `…0004` | `Pacific/Auckland` | MONDAY | `Hana` `311` OWNER | `Wiremu` `312` ADMIN |
| `HH_EMPTY` `…0005` | `Asia/Jakarta` | MONDAY | `Rani` `401` OWNER | — (onboarding empty state) |
| `HH_BUSY` (implied) | — | — | `Petra` `501` | `Otto` `502`, `Ivan` `503` |

* Users: `SEED_USERS` at `…@homeops.test` (`SEED_EMAIL_DOMAIN`), `emailVerified: true`, `image: null`, `createdAt` = `SEED_INSTANT` (Better Auth text ids, `DECISIONS.md` 2026-09-27).
* `household_settings` defaults are stated explicitly per `defaultSettings()`: `maintenanceLeadDays 7`, `snoozeMaxHours 24`, `infoExpiryDays 14`, `dailyCapCeiling 10`, `roomOverrideMaxHours 168` (DATA_MODEL.md §2.1).
* **What is NOT seeded yet (and throws if you ask):** `PENDING_SEED_SECTIONS` — `chores`, `rooms`, `issues`, `resources`, `maintenance`, `alerts`, `activity`, `recurrence`, etc. `seedDevelopmentData({sections: ["chores"]})` throws `Not implemented: T-xxx — the "chores" fixture section needs …` . The audit screenshots showing “We cannot find that page” are therefore honest: the task slice `VS-1…16` has not landed.
* **Required seed for a visual audit (per this MVP spec) would need:** 1 household, 2 adult members, several rooms, 5+ chores (overdue, due today, upcoming), household issue, maintenance item, low-stock resource, recent activity — **none of this exists today** beyond the household skeleton. `describeSeededHouseholds()` would report `HH_MAIN — 4 member(s)` etc after the identity seed.

**Accounts for manual QA (once PG + Better Auth session via `getSession()` is wired, T-ORG-001):**
`Sari` (OWNER), `Budi` (ADMIN), `Dita` (MEMBER), `Andi` (HELPER/away) — passwords are not seeded here; sign-up → `getSession()` → cookie is the `T-ORG-001` round-trip.

## MajelisHub (`majelishub-pengajian-event-platform-spec`) — `ops/db-migrate.mjs`, `drizzle/*.sql`, PGlite for tests

**Current reality (10 delivered tasks):** `T-ORG-001` (Better Auth identity + durable PG rate-limit), `T-SEC-001` (TenantScope + RLS policies + session vars), `T-SEC-002` (`requirePermission` + public-route allow-list), `T-SEC-007` (hash-chained `audit_events` + trigger), `T-ARCH-002/003` + `T-DOCS-001/003`. **No product seed** — `src/` has 10 state-machine domain transitions, 14 shared contracts, 49 page shells + 26 API shells, 4 migrations (`0000_identity_and_tenancy.sql`, `0001_row_level_security.sql`, `0002_audit_events.sql`, `0003_auth_rate_limit_counters.sql`).

**Required seed (per MVP spec, not yet implemented — would be `T-ORG-002` + `T-MOSQUE-001` + `T-EVENT-*`):**
* 1 organization, 2 mosque/locations (if model permits), admin/organizer/attendee users, upcoming kajian + completed event, registrations, attendance/check-in records.
* **What would be seeded after `T-ORG-002`/`T-MOSQUE-001`:** `organizations`, `memberships`, `mosques` (slug, timezone), `kajian` (slug, `eventId`, status `draft|published|completed`), `registrations`, `attendance`, `checkin` (QR/walk-in/manual).
* **No seed command exists today** — the harness is `ops/db-migrate.mjs` (apply), not a fixture loader. Tests use PGlite in-process `INSERT … ON CONFLICT DO NOTHING` factories.
* **Demo accounts to reserve (when implemented):** `admin@majelishub.test` (org OWNER), `organizer@majelishub.test`, `attendee@majelishub.test` — Better Auth, session in PG.

## Yomi (`yomi-manga-reader-arch-skeleton`) — `scripts/seed.mjs` + `src/server/db/schema/*`

**Two-phase harness (T-FOUND-012):** **Phase 1 today** (pre-`T-UPLOAD-004`): inserts DB rows with **placeholder** `asset_key`s (`sha256(slug|chapter|page)[:32]`, opaque, unguessable per `FR-MEDIA-003`) and true `byte_size_avif|webp|jpeg` (computed via `sharp` in-memory, bytes then dropped), **no S3 bytes** so media delivery 404s until pipeline lands. Phase 2 (post-`T-UPLOAD-004`): re-runs with `commitPages({replace:true})` to upload real variant keys via `ObjectStoragePort` and GC-queue old keys (`FR-UPLOAD-009`).

**Flags:** `--env dev|test` (REQUIRED), `--run-id`, `--manga`, `--load-titles`, `--page-size WxH`, `--chunk-size`, `--timings`. Exit 0 ok · 1 unexpected · 2 refused (guard/config/credential) · 4 schema not migrated. Uses `loadEnv` typed boot, `NFR-SEC-009` (refuse prod creds), `NFR-SEC-015` (parameterized Drizzle only), `NFR-DATA-001/002`, `NFR-PERF-014` (seeds the 500-page case).

**Determinism:** Titles numbered `Seed Manga 0001` .. `Seed Manga 0030-Pages`, `Seed Manga 0500-Pages` (reader-behavior.md §15), PK = `deterministicUuid(naturalKey)` (v7-shaped, not time-ordered), asset_key = `sha256(...)[:32]`, geometry fixed `480x720`, no timestamp/hostname/random in report. Argon2id password hash is **not** deterministic (random salt) — inserted once, never UPDATE, so re-hash never invalidates sessions.

**Idempotency:** `INSERT … ON CONFLICT DO NOTHING` only — no UPDATE/DELETE/DDL. In `--env test` every public identity (slug, email, alias, asset_key) is `run-id` prefixed for CI isolation; in `--env dev` no prefix so re-run is pure no-op. Repositories are used, not raw SQL (`createSeedRepositories(db)`).

**What `--env dev` would create today (once `DATABASE_URL` PG18 is up and `drizzle/0000_initial_schema.sql` migrated):**
* **Users:** `admin@yomi.test` (admin), `reader@yomi.test` (regular) — passwords: `yomi_admin` / `yomi_reader` (example; actual hash is random salt, so login is the test, not hash equality).
* **Manga:** 3 core + 30–10000 titles depending on `--load-titles`: `Seed Manga 0001` (12 pages), `Seed Manga 0030-Pages`, `Seed Manga 0500-Pages` (500 pages, 480×720, window `[1..3]` is exercised, `<60s` budget on retry), all with `manga.cover_asset_key` placeholder.
* **Chapters:** per manga, 1–3 chapters, each `chapter_page.asset_key` placeholder + true variant sizes.
* **Progress/Library:** `reading_progress` (page 12/12 for 0500 case), `bookmark`, `library_entry` (continue-reading ≤20, most recent first).
* **What we actually saw without PG:** `The catalog is unavailable` error boundary (filters work, grid fails: `Cause. The list of titles could not be read just now.`) — this is `readCatalogPage` failing, `readGenreFacets` failing independently, per the “reads are parallel, never block each other” contract in `discover/page.tsx`.

**Required seed (per this audit):** admin, regular reader, 3 manga, multiple chapters, page/image metadata, reading progress, bookmark, library entry — exactly what `seed.mjs` promises once the DB+upload lane is wired.

## Minimal Manga Reader (`manga-reader-spec-skeleton-minimal`) — `src/lib/manga.ts` (in-memory)

**No DB, no seed command — uses hard-coded sample Data:**

```ts
// src/app/discover/page.tsx + src/lib/manga.ts
{ title: "The Licensed Adventure", author: "Spec Team", direction: "RTL", slug: "sample-manga" }
chapter 1: "Chapter 1: The Beginning" (12 pages, asset key: `asset://manga-sample/ch-001/p-{1..12}`)
```

**What the screenshots proved exists:**
* **Discover:** 240px card grid `Cover Art` placeholder, direction badge `RTL`, `Read Chapter 1` CTA.
* **Reader:** `Chapter 1: The Beginning — Progress saved` header, controls: `Mode: Single Page | Dir: RTL (Manga) | 100%` (+/- zoom), `Tap sides: 25% left/right`, keyboard `Arrow L/R` (RTL-aware), `M: cycle mode`, `D: toggle direction`, `H: toggle chrome`, slider `Page 12 of 12` with `Window: [1..3]` (bounded window caching, ADR-007).
* **State:** `Progress saved` is in-memory (no DB), reload resets; no auth, no upload.

**Deterministic and rerunnable** — every run is identical; no external service.

## StrangerLink (`strangerlink-random-chat-webrtc-spec`) — ephemeral sessionStorage + in-memory matchmaking

**No DB, no seed file. State lives in:**

* `sessionStorage` (client): `strangerlink_consent` (version 1, 5 checkbox attestations + `attestedAt`), `strangerlink_mode` (`TEXT` | `TEXT_AUDIO` | `TEXT_VIDEO`), `strangerlink_interests` (≤5 from vocab), `strangerlink_language`.
* `src/server/realtime/server.ts` (ws) + `src/domain/matchmaking` (in-memory queue) + `src/server/rate-limit` (not started in this audit — Next dev only on 3105).

**What we seeded manually for screenshots:**

```js
const consent = {
  consentVersion: 1, ageAttested: true,
  acknowledgedStrangerRisk: true, acknowledgedEphemerality: true,
  acknowledgedExitRights: true, acknowledgedIpExposure: mode==='TEXT' ? true : false,
  attestedAt: new Date().toISOString()
};
sessionStorage.setItem('strangerlink_consent', JSON.stringify(consent));
sessionStorage.setItem('strangerlink_mode', 'TEXT');
sessionStorage.setItem('strangerlink_interests', JSON.stringify(['music']));
```

* **User A / User B:** Simulated by opening two browser contexts (not done here — single puppeteer page). The queue shows `Looking for someone… 2s elapsed` + `Trying to match your interests.` + `Cancel/Leave` — match state would require a second peer and the `realtime` ws server.
* **Safety/report/block:** `SAFETY_NOTICE_STATEMENTS` (5), `SAFETY_LIMITATIONS`, `age-gate` (4 checkboxes, blocked `Continue` until `canContinue`), `NFR-SAFE-003` disclaimer, `INTEREST_VOCABULARY` 10.
* **What was verified:** Age gate (160 KB screenshot), safety notice + mode + interests (full page), queue spinner (27 KB). Text chat and safety/report were not exercised with a real peer.

## SiomayOps (`siomayops-streetfood-stall-ops-spec`) — `src/app/sell/page.tsx` `MOCK_MENU` + in-memory store

**No `seed` script; Drizzle schema is canonical but pilot runtime is in-memory (per `schema.ts` comment).**

**What the running app *does* show (screenshots 33–84 KB):**

| Entity | Source | Screenshot |
|---|---|---|
| HQ | `src/app/page.tsx` `SiomayOps — Beranda penjual` with `Mulai Shift | Jualan | Stok | Pengeluaran | Tutup Shift` + `Akses Cepat HQ → Dashboard HQ | Peringatan` | `01-home.png` (33 KB) |
| 2 stalls | UI shells `/locations`, `/hq` (not seeded, just shells) | `07-locations.png` 22 KB, `06-hq.png` 84 KB |
| Operators | Not seeded (would be `operators` table: `orgId`, `areaId`, `phone_e164`, `contract_type`, `training_state`) | — |
| Products/menu | `MOCK_MENU` 4 items (IDs like `00000000-0000-7000-0000-000000000101`): `Siomay Ayam 15k`, `Campur 18k`, `Batagor 12k`, `Es Teh 5k` | `02-sell.png` 36 KB |
| Inventory | Shell `/stock` (28 KB) | `03-stock.png` |
| Pricing | `src/shared/money/money.ts` `IDR` minor units, `StatusBadge` `Total: 0 item`, `Total bayar Rp 0` | `02-sell.png` |
| Sales | Client `clientSaleId = crypto.randomUUID()`, `shiftId 00000000-0000-7000-0000-000000000001`, `lines: [{menuItemId, quantity}]` → `POST /api/v1/sales` (`Idempotency-Key`) | — |
| Payment | `POST /api/v1/payments/cash` with `amount:{amountMinor,currency IDR}`, `cashReceived`, `clientPaymentId` → fail-closed HMAC if `PAYMENT_PROVIDER=none` | — |
| Expense | `Catat Pengeluaran` button | `02-sell.png` |
| Loyalty customer | Not seeded (would be `loyalty` table) | — |
| Settlement | Not seeded; `PAYMENT_PROVIDER_SECRET_KEY` not set → `missing/invalid HMAC` is refused | — |

**Required seed (per this audit, not yet):** HQ, 2 stalls, operators, products/menu, inventory, pricing, sales, expense, loyalty customer, settlement — would need a `tools/seed.mjs` that writes via the same repositories the app uses (never hard-coded in features) and is idempotent, similar to Yomi.

## Parking Attendant (`parking-attendant-ops-app-spec`) — `demo.py` + `src/core/domain.py` / `src/infra/sqlite_store.py`

**Seeding is the demo itself** — deterministic, temp-dir, `FakeClock` fixed at `2026-09-26T06:00:00+00:00`, rerunnable (each run creates a new `/tmp/parking_demo_*`).

**What `python3 demo.py` creates (proven 2026-09-28 00:18):**

```
ParkingLocation: z1
Slots: A-01 (s1, MOTORCYCLE 0,0), A-02 (s2 4,0), A-03 (s3 8,0), C-01 (s4 CAR 0,6)
Attendant: att_budi, Supervisor: spv1 pin 1234, Device: dev_rugged_01
Shift: shf_morning zone z1 float Rp 100.000
Vehicles/Sessions:
  ses_6b7591962ba9 plate B 4821 SSG MOTORCYCLE slot A-01 → A-03 (REORGANIZATION) → checkout CASH 2h10m → 3 billable hrs → Rp 4.000 CHECKED_OUT
  ses_48a49ebe31df plate D 5678 XYZ CAR C-01 → mismatch vs D 9999 ZZZ → UNDER_INVESTIGATION → MISMATCH_HOLD
  ses_9f0b22bf7a47 plate F 1234 HIJ MOTORCYCLE → lost ticket (STNK+KTP+PIN) → Rp 24.000 (20k fine) CASH
Photos: evi_front.jpg SHA-256 52a71ad9…, geo -6.21,106.85, watermark, perspective FRONT
Incidents: inc_9b30ebe150 VEHICLE_DAMAGE freeze_retention true
Reconciliation: expected 128k actual 128k variance 0 BALANCED, handover 1 vehicle
Retention: purge 1 photo, mask 5 plates
Artifacts: parking.db 88 KB (SQLite), audit_ledger.jsonl 11 entries (seq, timestamp, action, actor, details), receipt.bin 667B ESC/POS 58mm
```

**Tests:** `python3 -m unittest discover` = 64 passed (covers check-in, checkout, pricing grace/progressive/cap/fine, OCR sanitizer `PlateSanitizer.sanitize("b 4821 ssg") → B 4821 SSG`, shift, incident, photo SHA-256, ticket QR `sig` HMAC, retention).

**Note:** `IOcrEngine.process_frame` is abstract (raises `NotImplementedError`); `MockEdgeOcrEngine` is test-only, not a production recognizer (`PRD §4.B.1` post-MVP). `VehicleWatchlistService` is stub.

## RSI Agent (`rsi-agent-recursive-self-improvement-prototype`) — `runs/` (regenerable, git-ignored)

**Seeding is `demo.py` flags + `rsi` memory.**  No DB; artifacts are `runs/` JSON/HTML.

**What `--waves 1 --tasks-per-wave 2 --drs-rounds 1 --drs-tasks 2 --holdout 4 --seed 0` creates (2026-09-28 00:18, mock Jev):**

```
BRS wave 1/1 2 tasks | success 1/2 (50%) | avg score 0.78 | memory 2 lessons
DRS round 1/1 2 tasks | success 1/2 (50%) | avg score 0.78 | memory 4 lessons
memory FROZEN at 4 lessons (7 knowledge keys) — test-time begins
TEST cold 0/4 (0%) | 0.57 | memory 0
TEST warm 0/4 (0%) | 0.57 | memory 4
report written to runs/report.md
```

* `runs/memory.json` (2.3K): 4 lessons (2 procedures conf 0.9, 2 boundaries conf 0.6) keys: `api-design, debugging, edge-cases, http, logging, refactor, typing` — sample: `[procedure] 'Fix failing test in payment retry logic': tests-before-patch then tests-after-patch`.
* `runs/attempts.jsonl` (full ReAct traces), `runs/audit.jsonl` (22K, hash-chained, tamper-evident), `runs/cycles.json` (20K), `runs/dashboard.html` (20K static, dark `#0f1117`, pills, cold vs warm table), `runs/baseline-*.json`.
* **Accounts:** no users — the “users” are the `Curriculum Agent` (BRS broad / DRS deep), `Actor Agent` (ReAct loop), `Verifier Agent`, and `Jev` (guard/route/score/done). `--backend openai` would need `OPENAI_API_KEY`, `--jev typesafe` needs `TYPESAFE_API_KEY` (real providers not equivalent to mock).

**Rerunnable/idempotent:** `--resume` continues from `runs/memory.json` else archives to `memory.prev.json`; `inflate` of seed is not needed — `demo.py` is deterministic given `--seed`.

## Summary of Gaps

* **HomeOps / MajelisHub / Yomi:** without a provisioned PG18 + `npm run db:migrate && npm run seed` the product UI is **honestly empty or error-boundary**, not fake data. The screenshots (8–25 KB empty shells) are the correct MVP evidence that the vertical slices `VS-1…` are pending.
* **Minimal:** needs no seed — its in-memory `sample-manga` (12 pages) is the seed.
* **SiomayOps:** needs a new `tools/seed.mjs` (not yet existent) that would insert via `server/db` repos into PG, not hard-coded `MOCK_MENU`.
* **Parking/RSI:** their `demo.py` *is* the seed and the proof.
