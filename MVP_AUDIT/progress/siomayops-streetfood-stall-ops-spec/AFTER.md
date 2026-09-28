# SiomayOps — AFTER (2026-09-28)

**Target:** `RUNNABLE_DEMO` → `MVP_PARTIAL` (real POS vertical: stall→POS→sale→inventory→cash→HQ)
**Result:** **ACHIEVED** — stall→POS→sale→inventory→cash→HQ now durable via file `data/db.json`.

## Runtime

```bash
cd siomayops-streetfood-stall-ops-spec
npm install --legacy-peer-deps  # 278 pkgs
PORT=3106 npm run dev -- --port 3106 --hostname 0.0.0.0  # → http://localhost:3106

# DB-driven menu (no MOCK_MENU)
curl -s http://localhost:3106/api/v1/menu/items | grep Siomay  # → 4 items (Ayam/Campur/Batagor/Es Teh)
curl -s http://localhost:3106/api/v1/menu/prices | grep unitPriceMinor # → 15000,18000,12000,5000
curl -s http://localhost:3106/api/v1/stock | grep currentQty    # → 40 each before sale, 38 after 2× Ayam
curl -s http://localhost:3106/api/v1/shifts?status=OPEN | grep Budi # → 1 shift OPEN ST-001 Alun-alun

# sale via API (same path UI uses)
curl -s -X POST http://localhost:3106/api/v1/sales -H "Idempotency-Key: <uuid>" -d '{"shiftId":"00000000-0000-7000-0000-000000000001","lines":[{"menuItemId":"00000000-0000-7000-0000-000000000101","quantity":2}],"clientSaleId":"<uuid>"}' # → saleId 42febc..., total 30000
curl -s -X POST http://localhost:3106/api/v1/payments/cash -H "Idempotency-Key: <uuid>" -d '{"saleId":"...","amount":{"amountMinor":30000,"currency":"IDR"},"cashReceived":{"amountMinor":50000,"currency":"IDR"},"clientPaymentId":"<uuid>"}' # → PAID change 20000
curl -s http://localhost:3106/api/v1/hq/sales | grep totalSales # → 2 after UI sale (API 1 + UI 1), gross CASH 60000
```

**URL:** `http://localhost:3106` — Next 15.4.2, `src/server/db/memory-store.ts` file-backed `data/db.json` (26K, 4 menu, 4 pricePolicies, 4 stockItems, 1 shift OPEN).

## Seed (deterministic, file-backed, idempotent — `data/db.json` via `loadStore()` / `ensureSeed()` / `persistStore()`)

`data/db.json` (created on first boot, atomic write `data/db.json.tmp` → `data/db.json`) contains:

- Organization `00000000-0000-7000-0000-000000000001` (Siomay Pusat), Area `00000000-0000-7000-0000-000000000003`
- Operators:
  - `00000000-0000-7000-0000-000000000010` Budi `+6281234567890` TRAINED ACTIVE
  - `00000000-0000-7000-0000-000000000011` Sari `+6281234567891` TRAINED
- Stall `00000000-0000-7000-0000-000000000020` `ST-001` MOBILE ACTIVE
- SellingLocation `00000000-0000-7000-0000-000000000030` Alun-alun Bandung `Jl. Asia Afrika No.1` ACTIVE
- Assignment `00000000-0000-7000-0000-000000000040` Budi → ST-001 PRIMARY
- MenuCategories `cat-001` Siomay, `cat-002` Minuman
- MenuItems 4 (DB, not MOCK):
  - `0101` Siomay Ayam `cat-001` sort1
  - `0102` Siomay Campur `cat-001` sort2
  - `0103` Batagor `cat-001` sort3
  - `0104` Es Teh `cat-002` sort4
- PricePolicies ORG scoped (effective 2026-09-27):
  - `pp-0101` 15000 IDR Ayam
  - `pp-0102` 18000 IDR Campur
  - `pp-0103` 12000 IDR Batagor
  - `pp-0104` 5000 IDR Es Teh
- StockItems 4: `0201` Siomay Ayam STK-001, `0202` Siomay Campur STK-002, `0203` Batagor STK-003, `0204` Es Teh STK-004
- StockMovements `RESTOCK` 40 each (`mov-init-0201` … `0204`) + `SALE -2` per completed sale (`sale-<saleId>-0101`)
- Shift `00000000-0000-7000-0000-000000000001` OPEN `2026-09-28` Budi→ST-001 Alun-alun, openingCash 50000, version1, with LocationReport `ARRIVED` `000...031` and stockSnapshots START 40
- Auth `DEFAULT_ORG_ID` unified to `00000000-0000-7000-0000-000000000001` (was `...8000...`), so `resolveSession()` and `createSale` agree on org.

## Flow exercised (critical user journey)

**Stall → POS → sale → inventory → cash → HQ** (using DB, not MOCK_MENU):

1. `GET /` → Beranda penjual — `Mulai Shift` teal, grid Jualan/Stok, `Akses Cepat HQ` — `01-home.png` 29K
2. `GET /sell` → Jualan — `GET /api/v1/menu/items` → 4 cards (`Siomay Ayam Rp 15.000` etc) each with `- 0 +`, footer `Menu dimuat dari DB (pricePolicies) • stok 40/porsi awal` — `02-sell.png` 35K
3. Interact: click `+` on Siomay Ayam twice → qty 2, `Total bayar Rp 30.000` → `02b-sell-2x.png` 36K, input `Tunai diterima 50000` → `Kembalian Rp 20.000`
4. Click `Bayar Tunai` → `POST /api/v1/sales {shiftId, lines:[{menuItemId, quantity:2}], clientSaleId}` with `Idempotency-Key` → `POST /api/v1/payments/cash {saleId, amount 30000, cashReceived 50000}` → `Berhasil! Kembalian Rp 20.000` — `03-sell-after-sale.png` 38K, `saleId 7a3e32e8…` (UI second sale; first API sale `42febc…` already exists)
5. `GET /stock` → Stok — `GET /api/v1/stock` shows `Siomay Ayam 36` (40–2 via `SALE` movement), Campur 40, Batagor 40, Es Teh 40 — `04-stock.png` 41K, total 156 porsi
6. `GET /hq` → HQ Dashboard — `Coverage Hari Ini: Shift aktif 1`, `Penjualan Hari Ini: Total Rp 60.000 • Transaksi 2 • tersinkronisasi`, `Posisi Kas: Diharapkan Rp 110.000 (50k opening + 60k cash) • Dihitung Rp 110.000 • Selisih 0`, `Antrian Verifikasi 0`, `Stok menipis 0 / Habis 0` with per-item qty — `05-hq.png` 70K
7. `GET /shift` → Mulai Shift — detail `ST-001 Alun-alun Bandung Kas awal Rp 50.000` — `06-shift.png` 33K
8. Mobile 390×844:
   - `/` → `07-mobile-home.png` 23K — stacked teal
   - `/sell` → `08-mobile-sell.png` 28K — 1-column menu
9. **Persistence verification (restart):**
   ```bash
   curl -s http://localhost:3106/api/v1/stock | grep 36          # before restart 36
   curl -s http://localhost:3106/api/v1/hq/sales | grep 60000   # before 60000 2 sales
   # stop/start
   PORT=3106 npm run dev -- --port 3106 &
   curl -s http://localhost:3106/api/v1/stock | grep 36          # after restart 36
   curl -s http://localhost:3106/api/v1/hq/sales | grep 60000   # after 60000
   cat data/db.json | wc -c => 25899 (26K)
   ```
   File `data/db.json` survives restart; wrapper `wrapMapsForPersist()` + `loadStore()` with `dateReviver` keeps Dates.

## Screens (after) — 9 captures (8 canonical + 1 intermediate)

| File | Size | Route | What became real |
|---|---|---|---|
| `01-home.png` | 29K | `/` | Beranda with DB-seeded stall hint |
| `02-sell.png` | 35K | `/sell` | Jualan — 4 cards **from `GET /api/v1/menu/items`** (not MOCK_MENU), DB badge |
| `02b-sell-2x.png` | 36K | `/sell` after +2 | Cart qty 2, total 30k, cash 50k, kembalian 20k |
| `03-sell-after-sale.png` | 38K | `/sell` after Bayar | `Berhasil! Kembalian Rp 20.000`, cart reset |
| `04-stock.png` | 41K | `/stock` | Stok — `Siomay Ayam 36` (was 40 before sale), other 40, total 156 |
| `05-hq.png` | 70K | `/hq` | HQ — `Penjualan Rp 60.000 / 2 transaksi`, Coverage 1, Kas 110k, Stok 36 detail |
| `06-shift.png` | 33K | `/shift` | Shift detail ST-001 |
| `07-mobile-home.png` | 23K | `/` mobile | Responsive |
| `08-mobile-sell.png` | 28K | `/sell` mobile | 1-col menu |

## Persistence

- Before: in-memory `Map` wiped on restart; `MOCK_MENU` not from DB.
- After: `src/server/db/memory-store.ts` now file-backed: `loadStore()` (dateReviver ISO→Date), `persistStore()` atomic `db.json.tmp`, `wrapMapsForPersist()` auto-persists on `Map.set/delete/clear` + `auditEvents.push`, `ensureSeed()` idempotent deterministic seed, `completeSale()` creates `stockMovements SALE -qty` idempotently. Verified via restart: `GET /stock 36` and `GET /hq/sales 60000/2` before → after restart identical, `data/db.json` 25 899 bytes retained.

## Remaining P0

- QRIS settlement still fail-closed (correct per `PAYMENT_PROVIDER` not configured) — cash path is real, digital pending `PENDING_VERIFICATION` not exercised; out of scope for MVP_PARTIAL narrowest slice (spec says do not attempt full QRIS).
- HQ freshness/verification still simplified (no S3 evidence, no expense loyalty); but sales→HQ vertical now real.
- `pnpm` vs `npm` lock mismatch, 37 audit advisories remain (dep vulns).
