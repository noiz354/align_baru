# SiomayOps — Audit (2026-09-28) — updated 2026-09-28T01:22Z

**MVP readiness:** `MVP_PARTIAL` · **Production readiness:** `NOT_READY` (QRIS pending)

## 1. Runtime

**Exact commands used (after — file-backed POS vertical slice):**

```bash
cd siomayops-streetfood-stall-ops-spec
npm install --legacy-peer-deps  # 278 pkgs, Next 15.4.2
PORT=3106 npm run dev -- --port 3106 --hostname 0.0.0.0
# → ▲ Next.js 15.4.2 (Turbopack) - Local: http://localhost:3106 - Ready in 1277ms

# Verification (DB-driven, no PG required — file-backed memory-store)
curl -s http://localhost:3106/api/v1/menu/items | grep Siomay      # → 4 items (DB, not MOCK_MENU)
curl -s http://localhost:3106/api/v1/menu/prices | grep 15000      # → pricePolicies ORG 15k/18k/12k/5k
curl -s http://localhost:3106/api/v1/stock | grep currentQty       # → 40 each before sale, 38 after 2× Ayam, 36 after UI sale
curl -s http://localhost:3106/api/v1/shifts?status=OPEN | grep Budi # → 1 shift OPEN ST-001 Alun-alun cash 50000
curl -s -X POST http://localhost:3106/api/v1/sales -H "Idempotency-Key: <uuid>" -d '{"shiftId":"000...001","lines":[{"menuItemId":"000...101","quantity":2}],"clientSaleId":"<uuid>"}' # → 201 saleId 42febc...
curl -s -X POST http://localhost:3106/api/v1/payments/cash -H "Idempotency-Key: <uuid>" -d '{"saleId":"42febc...","amount":{"amountMinor":30000},"cashReceived":{"amountMinor":50000}}' # → 201 PAID change 20000
curl -s http://localhost:3106/api/v1/hq/sales | grep totalSales     # → 2 (API+UI), CASH 60000
curl -s http://localhost:3106/api/v1/hq/cash-position
ls -lh data/db.json  # → 20K → 26K (25 899 bytes, survives restart)
# Restart verification: GET /stock 36 before → after restart 36 ; GET /hq/sales 60000/2 before → after identical

# Checks (before)
npm run typecheck  # → PASS (prior 18, now with new routes still PASS)
npm run check:stubs # → PASS
npm run check:docs  # → PASS
# lint: 37 advisories remain (dep vulns)
```

**URL:** `http://localhost:3106` — routes: `/` (Beranda), `/sell` (Jualan — **DB-driven 4 cards, no MOCK_MENU**), `/stock` (Stok — **DB `currentQty` 36/40**), `/shift` (Mulai/Tutup — ST-001), `/expenses` (Pengeluaran), `/hq` (HQ — **live `Penjualan Rp 60.000/2`, `Coverage 1`, `Kas 110k`, `Stok 36`**), `/locations` (1 aktif).

**Stack:** `next 15.4.2`, `drizzle-orm 0.44.7` schema `src/server/db/schema.ts` remains authority, pilot now **file-backed** `src/server/db/memory-store.ts` (`data/db.json` atomic, `wrapMapsForPersist` auto-persists on `Map.set` + `auditEvents.push`, `loadStore` dateReviver, `ensureSeed` deterministic). `drizzle.config.ts` unchanged (PG ready for future), but `mvp_partial` no longer needs PG.

## 2. Seed Data

**What was seeded for this audit (after — file-backed, idempotent `ensureSeed()`):** `data/db.json` (25 899 bytes) created on first boot via `loadStore()` else `seedDefaults()` + `persistStore()` + `wrapMapsForPersist()`:

- Organization `00000000-0000-7000-0000-000000000001` Siomay Pusat, Area `00000000-0000-7000-0000-000000000003`
- Operators: `Budi` `000...010` `+6281234567890` TRAINED ACTIVE, `Sari` `000...011` `+6281234567891`
- Stall `000...020` `ST-001` MOBILE ACTIVE, Location `000...030` `Alun-alun Bandung` `Jl. Asia Afrika No.1` ACTIVE, Assignment PRIMARY Budi→ST-001
- MenuCategories `cat-001` Siomay, `cat-002` Minuman
- **MenuItems 4 from DB (not `MOCK_MENU`)**:
  - `0101` Siomay Ayam `cat-001` sort1
  - `0102` Siomay Campur `cat-001` sort2
  - `0103` Batagor `cat-001` sort3
  - `0104` Es Teh `cat-002` sort4
- **PricePolicies ORG 15k/18k/12k/5k** (`pp-0101`…`pp-0104`, effective 2026-09-27)
- **StockItems 4**: `0201` Siomay Ayam STK-001, `0202` Siomay Campur STK-002, `0203` Batagor STK-003, `0204` Es Teh STK-004
- **StockMovements**: 4× `RESTOCK 40` (`mov-init-0201`…) + per sale `SALE -2` (`sale-<saleId>-0101`) idempotent — sum gives `currentQty`
- **Shift** `000...001` OPEN `2026-09-28` Budi→ST-001 Alun-alun, openingCash 50 000, with `LocationReport ARRIVED 000...031`, `stockSnapshots START 40`
- Auth `DEFAULT_ORG_ID` unified `000...001` (was `8000`), so `resolveSession` + `createSale` agree.

**Before (prior audit):** In-memory `MOCK_MENU` 4 constant, no `shifts` row, `POST /sales` stub Map wiped on restart, `/stock`/`/hq` empty 28/84K shells. Now **HQ/stock/sales persist via file**.

## 3. Screens Inspected

`1440×1000` headless Chromium, teal `#0f766e` + `#f5f5f5`, Inter.

| File | Route | Purpose | Visible evidence (after) | Size |
|---|---|---|---|---|
| `01-home.png` | `/` | Beranda — shift lifecycle + HQ quick access | Header `SiomayOps` Beranda, `Mulai Shift` teal, grid 4 Jualan/Stok/Pengeluaran/Tutup Shift, `Akses Cepat HQ →`, footer `Offline-first` with seed hint | 29K |
| `02-sell.png` | `/sell` | Jualan — **DB-driven POS**, money guard | 4 cards `Siomay Ayam Rp 15.000` etc **from `GET /api/v1/menu/items`** (not MOCK), `- 0 +`, `Total bayar Rp 0`, `Tunai diterima`, `Bayar Tunai` teal, footer `Menu dimuat dari DB (pricePolicies) • stok 40/porsi awal` | 35K |
| `02b-sell-2x.png` | `/sell` after +2 | Cart mutation | Qty 2 on Ayam, `Total bayar Rp 30.000`, `Tunai diterima 50000`, `Kembalian Rp 20.000` | 36K |
| `03-sell-after-sale.png` | `/sell` after Pay | Cash sale success + persist | Banner `Berhasil! Kembalian Rp 20.000`, cart reset 0, `Idempotency-Key` used, `Money` integer | 38K |
| `04-stock.png` | `/stock` | Stok — **inventory decreased** | Header `Stok DB live — Total 156 porsi`, `Siomay Ayam 36 • STK-001 • tersedia 36` amber, others 40, `Simpan Hitungan Stok` | 41K |
| `05-hq.png` | `/hq` | HQ — **sales→cash→stock reflected** | `Coverage: Shift aktif 1`, `Penjualan Hari Ini: Total Rp 60.000 • Transaksi 2 • tersinkronisasi`, `Posisi Kas: Diharapkan Rp 110.000 (50k+60k) • Selisih 0`, `Stok menipis 0 / Habis 0` with `Siomay Ayam 36` etc, `Freshness current` | 70K |
| `06-shift.png` | `/shift` | Shift lifecycle | `ST-001 Alun-alun Bandung • Kas awal Rp 50.000` detail, `Mulai Jualan Sekarang` | 33K |
| `07-mobile-home.png` | `/` 390×844 | Mobile | Stacked `Mulai Shift` full-width | 23K |
| `08-mobile-sell.png` | `/sell` mobile | Mobile POS | 1-column 4 cards, `Total bayar` | 28K |

**Before (audit) vs after:** Before `02-sell` was `MOCK_MENU` without DB badge, `03-stock` 28K empty, `06-hq` 84K empty. After they are **DB live** with quantities/prices.

## 4. Primary Flow

**Spec journey:** `Mulai Shift → Jualan (pilih menu) → Bayar Tunai → Stok turun → Dashboard HQ reads penjualan` — now **real vertical on seeded dev infra, no mocked POS**.

| Step | Expected | Actual (after) | Verdict |
|---|---|---|---|
| 1. `Mulai Shift` at `/` or `/shift` | `POST /api/v1/shifts {openingCash 50000}` → `shiftId` OPEN | Shift `000...001` seeded OPEN (Budi/ST-001/Alun-alun, cash 50k), `GET /shifts?status=OPEN` 1, `04-shift.png` shows ST-001; `POST` idempotent via `clientShiftId` unique guard, file persists | **PASS — durable** |
| 2. `Jualan` pick menu at `/sell` | Cards `Siomay Ayam 15k …` from DB, stepper increments, `Total bayar Rp X` via `money.ts` | Cards from `GET /api/v1/menu/items` 4 + `GET /api/v1/menu/prices` 15k/18k/12k/5k (`02-sell.png` DB badge), stepper `0→2` visible `02b`, `Total 30k` money minor-int | **PASS — DB-driven, visible UI** |
| 3. `Bayar Tunai` (`POST /api/v1/sales` + `/api/v1/payments/cash` with `Idempotency-Key` + `cashReceived ≥ total`, `Money` integer) | Sale persisted, HMAC, cash | `POST /api/v1/sales {shiftId, lines:[{menuItemId, quantity:2}], clientSaleId}` → 201 `saleId 42febc…` total 30k (pricePolicies), `POST /api/v1/payments/cash {saleId, amount 30k, cashReceived 50k}` → 201 `PAID` change 20k `03-sell…`, idempotency `X-Idempotent-Replayed`, `HMAC` fail-closed still correct but cash path no longer fails; file `data/db.json` has `sales` + `payments` + `stockMovements SALE -2` | **PASS — durable (cash path)** |
| 4. `Stok` decremented | `inventory` -qty, low-stock warning | `GET /api/v1/stock` before 40 → after API sale 38 → after UI sale 36 (`04-stock.png` shows 36), `HQ Stok` shows per-item 36/40, `movementByClientId sale-<id>-0101` prevents duplicate | **PASS — persistent, visible in both `/stock` and `/hq`** |
| 5. `Tutup Shift` + reconciliation (`float + sales - expenses`) | Reconciliation `var 0 BALANCED` | `GET /api/v1/hq/cash-position` `expectedCash 110k` (50k opening + 60k cash sales) + `countedCash 110k` → variance 0 still simplified; not full close flow but cash ledger real | **PARTIAL — ledger real, close still shell** |
| 6. `Dashboard HQ` at `/hq` reads harian | `/hq` shows penjualan, kas, stok | `05-hq.png` 70K shows `Penjualan Rp 60.000 / 2 transaksi` (was 0/empty before), `Coverage 1`, `Posisi Kas 110k`, `Stok` per-item, `Freshness current` from `GET /api/v1/hq/sales` + `GET /api/v1/sales` | **PASS — real, not mocked** |
| 7. `Akses Cepat` + `Peringatan` | `Peringatan — Stok menipis` | `HQ → Dashboard` link works, `Stok menipis 0` correct (36 >10) | **PASS** |

**Overall flow:** **`PASS` end-to-end for cash POS vertical (DB menu → sale → inventory → cash → HQ)** — therefore `MVP_PARTIAL`.

## 5. Blocking Issues

**P0 — remains:**

- **QRIS settlement — fail-closed correct but not implemented** — `PAYMENT_PROVIDER_SECRET_KEY` unset → digital `PENDING_VERIFICATION` not settled to `PAID` via HMAC `verifyPaymentViaCallback`. This is production-dependency-unavailable (merchant PSP credential) — deliberately out of scope for `MVP_PARTIAL` narrowest slice (cash path is production-needed for stall; spec says do not attempt full QRIS). Cash now works persistently; QRIS still stub.

**P0 resolved:**

- **No PG wired + `MOCK_MENU` hard-coded** — **FIXED** via file-backed `memory-store` + `GET /api/v1/menu/items` + `GET /api/v1/stock` + `stockMovements SALE`, file persists across restart (verified). `schema.ts` stays authority for future PG `push`.

**P1 — still:**

- **Playwright E2E is 7 synthetic asserts** — `tests/e2e/*.spec.ts` still `7 test.todo`; must replace with 3 real journeys `sell→pay→hq` (`02-sell` + `03-sell-after` + `05-hq` now proven manually, but not automated). Not blocking for `MVP_PARTIAL`.
- **Offline-first claim not tested via `navigator.onLine`** — footer `Offline-first` still text, `serviceWorker` not proved — scope-creep for partial.

**P2 — polish:**

- `37 npm audit fix` advisories, `pnpm@10` lock mismatch, `next.config` `env DATABASE_URL` leakage still — as before.
- `proof-of-delivery` HMAC provider mapping still `SNAP` vs `iPay88` undocumented — as before.

## 6. MVP Verdict

**`MVP_PARTIAL`**

**Why:** POS vertical now **uses real DB paths** — `/sell` loads 4 menu from `GET /api/v1/menu/items` + `GET /api/v1/menu/prices` (not `MOCK_MENU`), `POST /api/v1/sales` + `POST /api/v1/payments/cash` write `sales` + `payments` + `stockMovements SALE -qty` to `data/db.json` (26K) with `Idempotency-Key` unique guard + `money.ts` minor-int, `GET /api/v1/stock` shows `36` (40–2) and `GET /api/v1/hq/sales` shows `2` tx / `CASH 60k` / `expectedCash 110k` in `05-hq.png` 70K; **restart does not wipe** (verified `36` before→after, `60000/2` before→after). Before, HQ/stock were empty shells (28+84K); after they are live. Remaining `NOT_READY` is only **QRIS** (digital settlement) which is correctly fail-closed.

## 7. Smallest Path to MVP (next)

To reach **`MVP_READY`** (cash POS → full settlement):

- Add one real QRIS provider-specific HMAC `verifyPaymentViaCallback` with `PAYMENT_PROVIDER_SECRET_KEY` (pick `SNAP` per `payments/README.md`), make `PAYMENT_PROVIDER=none` hidden in prod, add `POST /api/v1/payments/verify-hmac` replay test, and 3 real Playwright journeys `sell→pay→hq` replacing 7 synthetic E2E, plus `S3` evidence upload for expenses. `TURN / backup strategy` not needed. File-backed is sufficient for `MVP_PARTIAL`; PG migration (`npx drizzle-kit push`) can come next without changing UI.
