# SiomayOps — CHANGES (narrowest slice: RUNNABLE_DEMO → MVP_PARTIAL)

**Goal:** Enable **stall→POS→sale→inventory→cash→HQ** with file-backed persistence, remove `MOCK_MENU` from exercised flow, seed deterministic demo data. Keep Drizzle `schema.ts` as authority, but make pilot `memory-store` durable (no PG required for partial).

## Files created/modified

- `src/server/db/memory-store.ts` **(modified, +~200 lines)** — file-backed persistence:
  - `import fs,path`, `DB_PATH = path.join(process.cwd(),"data/db.json")`, `dateReviver` ISO→Date, `persistStore()` atomic write via `db.json.tmp`, `loadStore()` restores 27 Maps + `auditEvents` array, `wrapMapsForPersist()` monkey-patches `Map.set/delete/clear` + `auditEvents.push` to auto-persist, `ensureSeed()` deterministic seed (idempotent), `clear()` persists, `toJakartanBusinessDay()` for shift, export `persistNow()`. Seed: org `000...001`, area `003`, operators Budi/Sari, stall ST-001, location Alun-alun, assignment, 2 menuCategories, 4 menuItems `0101-0104`, 4 pricePolicies ORG 15k/18k/12k/5k, 4 stockItems `0201-0204`, 4× `RESTOCK 40`, 1 OPEN shift `000...001` with businessDay `toJakartanBusinessDay`, locationReport ARRIVED, stockSnapshots START 40. Unified file creation: `data/db.json` 25 899 bytes.

- `src/server/auth/port.ts` **(modified, 2 lines)** — `DEFAULT_ORG_ID` `8000` → `0000` (`00000000-0000-7000-0000-000000000001`) to align `resolveSession()` with `createSale` `DEFAULT_ORG`; also `userId` `...0011` → `...0002` consistency.

- `src/features/sales/index.ts` **(modified, +~40 lines)** — `completeSale()` now idempotently creates `stockMovements` `SALE -qty` per line: `menuToStock {0101→0201,0102→0202,0103→0203,0104→0204}`, `clientMovementId = sale-${saleId}-${menuItemId}`, avoids duplicate on replay, sets `movementByClientId`, enabling `GET /api/v1/stock` to show decrement (40→38→36).

- `src/app/api/v1/stock/route.ts` **(created, 27 lines)** — `GET /api/v1/stock` (auth `stock:view`), computes `currentQty` per `stockItem` as sum of `stockMovements` for org, returns `[{stockItemId, code, name, category, unit, active, currentQty}]` with `meta.computedAt`.

- `src/app/api/v1/menu/prices/route.ts` **(created, 20 lines)** — `GET /api/v1/menu/prices` (auth `menu:view`), returns latest ORG `pricePolicies` per `menuItemId` as `{menuItemId, unitPriceMinor}` for DB-driven price display.

- `src/app/sell/page.tsx` **(rewritten, 163→183 lines)** — removed `const MOCK_MENU`; now `useEffect` fetches `GET /api/v1/menu/items` (`active` filter, sortOrder) + tries `GET /api/v1/menu/prices` for real `priceMinor` (fallback map for resilience), shows `Memuat menu dari DB…` → `Menu kosong` or 4 cards, adds footer `Menu dimuat dari DB (pricePolicies) • stok 40/porsi awal`, handles `saleData.saleId || data.saleId`, `amountMinor` from `saleData.data.total`; cart reset via `prev.map`. No longer hard-coded `MOCK_MENU` is exercised.

- `src/app/hq/page.tsx` **(rewritten, 149→150 lines)** — removed mock `1250000/42`; now `useEffect` parallel fetches `GET /api/v1/sales?limit=100`, `GET /api/v1/hq/sales`, `GET /api/v1/stock`, `GET /api/v1/shifts?status=OPEN`, `GET /api/v1/hq/cash-position`; derives `shiftsActive`, `totalSales count/minor`, `expectedCash = openingCash + CASH`, `verification pending`, `stock low/habis` per qty<10, displays per-stock `currentQty`, live `FreshnessBadge`, `Coverage 1`, `Penjualan Rp 60.000/2`, `Posisi Kas 110k`.

- `src/app/stock/page.tsx` **(rewritten, 79→110 lines)** — now `GET /api/v1/stock` on mount, maps `currentQty` → `counted` default, shows `tersedia: <strong>36</strong> porsi` with low-stock amber `fef3c7`, header `DB live — Total 156 porsi`, retains `POST /api/v1/stock-reports` CLOSING_COUNT.

## What became real vs mocked

| Area | Before | After |
|---|---|---|
| Menu source | `MOCK_MENU` constant in component | `GET /api/v1/menu/items` + `GET /api/v1/menu/prices` from `memoryStore`/`pricePolicies` DB |
| Price truth | Hard-coded `priceMinor` in MOCK | `resolvePriceForSale` via `pricePolicies` ORG scope (15k/18k/12k/5k) on sale creation; UI displays DB price |
| Sale persistence | `Map` volatile, restart wipes | `persistStore()` atomic file `data/db.json` 26K survives restart (verified 38→after restart 38, 36→36) |
| Inventory | No movement, `/stock` empty | `completeSale()` creates `SALE -qty` movements, `GET /api/v1/stock` sums to 38→36, HQ stock card shows per-item qty |
| Cash/ HQ | Mock `1.25M/42` hard-coded | `GET /api/v1/hq/sales` `CASH 60k/2` + `openingCash 50k` → `expectedCash 110k`, `sales` list 2× COMPLETED |
| Auth org | `8000` vs `0000` mismatch | Unified to `0000` |
| Seed | None | Deterministic file-backed seed on first boot (idempotent) |

## What deliberately not done (stay narrow)

- No real PG `drizzle-kit push` (use file-backed as bridge; schema.ts remains authority for future PG).
- No QRIS provider HMAC settlement (cash path real, digital still `PENDING_VERIFICATION` mock — correct fail-closed).
- No S3 evidence, loyalty, expense review.
- No full offline `IndexedDB` queue — `OfflineBanner` still uses `navigator.onLine`, but sale now persisted server-side for audit.

## Verification

- `curl -s http://localhost:3106/api/v1/menu/items` → 4
- `curl -s http://localhost:3106/api/v1/stock` → 40 before, 38 after API sale, 36 after UI sale
- `curl -s http://localhost:3106/api/v1/hq/sales` → totalSales 1 (API) → 2 (UI), CASH 30k→60k
- Restart: `curl` before vs after identical, `data/db.json` 25 899 bytes
- Browser screenshots after 9 files 29–70K (home→sell→sale→stock→hq→shift→mobile) vs before 8 files 22–84K.
