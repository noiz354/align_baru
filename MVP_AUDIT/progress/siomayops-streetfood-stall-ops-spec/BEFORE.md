# SiomayOps — BEFORE (2026-09-28)

**Target:** `RUNNABLE_DEMO` → `MVP_PARTIAL` (real POS vertical slice)
**Result before:** `RUNNABLE_DEMO` — POS is clickable but not durable; surrounding product empty shells.

## Runtime (before)

```bash
cd siomayops-streetfood-stall-ops-spec
npm install --legacy-peer-deps  # 278 pkgs, Next 15.4.2
PORT=3106 npm run dev -- --port 3106 --hostname 0.0.0.0
# → http://localhost:3106

curl http://localhost:3106/api/v1/menu/items  # → [] (no seed, in-memory empty)
curl http://localhost:3106/sell | grep Siomay  # → MOCK_MENU 4 cards hard-coded in src/app/sell/page.tsx, not from DB
curl http://localhost:3106/api/v1/stock  # → 404 (no endpoint)
curl http://localhost:3106/api/v1/hq/sales  # → totalSales 0, gross 0
```

**Stack:** Next 15.4.2, `drizzle-orm` + `schema.ts` exists but pilot uses in-memory `Map` volatile; `src/app/sell/page.tsx` defines `MOCK_MENU` constant, `src/app/hq/page.tsx` hard-codes mock `42` transactions `1.25jt`, stock/hq empty.

## Seed (before) — in-memory mock only

`src/app/sell/page.tsx`:

```ts
const MOCK_MENU = [
  { menuItemId:"00000000-0000-7000-0000-000000000101", name:"Siomay Ayam", priceMinor:15000 },
  { menuItemId:"00000000-0000-7000-0000-000000000102", name:"Siomay Campur", priceMinor:18000 },
  { menuItemId:"00000000-0000-7000-0000-000000000103", name:"Batagor", priceMinor:12000 },
  { menuItemId:"00000000-0000-7000-0000-000000000104", name:"Es Teh", priceMinor:5000 },
];
```

- `shiftId` hard-coded `00000000-0000-7000-0000-000000000001` but no `memoryStore.shifts` record exists → sale would fail if DB path used; pilot `createSale` returns in-memory `Map` stub that vanishes on restart.
- `POST /api/v1/sales` + `POST /api/v1/payments/cash` are in-memory `Map` + `HMAC fail-closed` when `PAYMENT_PROVIDER=none`; no `drizzle` write, no stock movement.
- HQ, stalls, operators, inventory not seeded via DB — `schema.ts` shells, `GET /hq` shows empty cards.

## Screens (before) — 8 audit captures 33–84 KB

| File | Route | Evidence |
|---|---|---|
| `01-home.png` 33K | `/` | Beranda penjual — `Mulai Shift` teal, grid Jualan/Stok/Pengeluaran/Tutup Shift, `Akses Cepat HQ →`, footer `Offline-first` |
| `02-sell.png` 36K | `/sell` | Jualan — `MOCK_MENU` 4 cards (`Siomay Ayam Rp 15.000` etc), `- 0 +`, `Total bayar Rp 0`, `Bayar Tunai` teal, no DB badge |
| `03-stock.png` 28K | `/stock` | Stok — empty shell `No inventory rows` |
| `04-shift.png` 40K | `/shift` | Shift — `Mulai Jualan Sekarang` with `Kas awal Rp 50.000` but no open shift in-memory |
| `05-expenses.png` 42K | `/expenses` | Pengeluaran — empty form |
| `06-hq.png` 84K | `/hq` | HQ — `Dashboard HQ` empty cards, no sales chart, `Stok menipis` 0 |
| `07-locations.png` 22K | `/locations` | Lokasi — 2 gerobak shell, no rows |
| `mobile-01-home.png` 27K | `/` mobile | Mobile stacked |

All 8 are in `MVP_AUDIT/screenshots/siomayops/` and copied to `screenshots/before/` for this progress record.

## Primary flow (before) — `MOCK` beyond POS click

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. Mulai Shift | `POST /api/v1/shifts` → `shiftId` OPEN | Button exists but volatile `Map`, no DB row, restart wipes | PARTIAL |
| 2. Jualan pick menu | Cards from DB | Cards from `MOCK_MENU` constant | MOCK |
| 3. Bayar Tunai | `POST /api/v1/sales` + `/payments/cash` `Idempotency-Key`, `Money` integer, HMAC | In-memory stub, fail-closed HMAC, no `drizzle` | MOCK |
| 4. Stok turun | `inventory` -qty | `/stock` empty, no movement | MOCK |
| 5. HQ reads harian | `/hq` penjualan | Empty (`06-hq.png` 84K) | FAIL |
| 6. Kas | `openingCash 50k + sales` | Not persisted | FAIL |

**Verdict RUNNABLE_DEMO:** UI clickable (`- 0 +`, `Bayar Tunai`, `money.ts` guard) but persistence, settlement, HQ mocked; restart wipes sale.

## Blocking issue (P0)

- **No PG wired + `MOCK_MENU` hard-coded** — `sell/page.tsx → server/db` does not write `sales/saleLines/inventory/expenses`; `Map` volatile. Single narrowest slice: wire existing Drizzle/`memory-store` to file-backed `data/db.json`, replace `MOCK_MENU` with `GET /api/v1/menu/items` (`pricePolicies` ORG scoped), make `POST /api/v1/sales` → `POST /api/v1/payments/cash` → `stockMovements SALE -qty` persisted, HQ `GET /api/v1/hq/sales` + `GET /api/v1/stock` reflect transaction. Seed `organizations/Siomay Pusat`, 1 stall `ST-001`, 1 location `Alun-alun Bandung`, 2 operators `Budi/+62812…`, 4 menu `Siomay Ayam/Campur/Batagor/Es Teh` with `pricePolicies` (15k/18k/12k/5k), stock 40/porsi, opening cash 50k, OPEN shift `000...001`.

## Evidence location

- BEFORE screenshots: `MVP_AUDIT/progress/siomayops-streetfood-stall-ops-spec/screenshots/before/` (8 files copied from `MVP_AUDIT/screenshots/siomayops/`)
- Runtime URL: `http://localhost:3106` (before)
