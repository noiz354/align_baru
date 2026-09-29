# 05 — Transaction Write Flow (`Catat Transaksi`)

## Previous State

Prior to this vertical slice:
1. `src/app/hq/page.tsx` was a client-only component that fetched summary cards via `useEffect` (`GET /api/v1/hq/sales`, `/api/v1/hq/cash-position`, `/api/v1/locations`, `/api/v1/closings`, `/api/v1/hq/exceptions`, `/api/v1/shifts`) and had no **Catat Transaksi** action, no per-outlet sales breakdown table, and no recent transaction activity feed.
2. `src/features/hq/index.ts` computed aggregate card metrics (`getSalesCard`, `getCoverageCard`, `getCashPositionCard`, `getVerificationBacklogCard`) directly from `memoryStore`, without exposing a unified dashboard read model (`getDashboardReadModel`) with per-outlet sales aggregation (`outlets`) or recent transactions (`recentActivity`), and without synchronizing cross-worker disk state before reads.
3. `src/server/db/repository.ts` only exposed `operators`, leaving sales, payments, shifts, stalls, and selling locations without scoped repository operations.
4. `src/server/db/memory-store.ts` overwrote `data/db.json` with empty collections whenever `memoryStore.clear()` ran during `vitest` suites, wiping seeded and persisted runtime state.

---

## Input Contract

The transaction write contract is defined in `src/shared/contracts/sales.ts` (`recordTransactionRequestSchema` / `RecordTransactionRequest`):

| Field | Type | Required | Description / Constraints |
| --- | --- | --- | --- |
| `outletId` | `string` (UUID) | Yes | Target authorized stall (`stallId`) or selling location (`sellingLocationId`) UUID. |
| `amount` | `number` (integer) | Yes | Positive safe integer in IDR minor units (`1..100_000_000`, i.e., `Rp 1` to `Rp 100.000.000`). |
| `paymentMethod` | `"CASH" \| "QRIS_STATIC" \| "QRIS_DYNAMIC" \| "BANK_TRANSFER" \| "EWALLET" \| "OTHER_DIGITAL"` | No (defaults to `"CASH"`) | Payment instrument used for the transaction. |
| `occurredAt` | `string` (ISO-8601) | No (defaults to server timestamp) | Business timestamp of transaction; must be valid ISO-8601 and not in the future (`<= now + 5 min`). |
| `note` | `string` | No | Optional transaction note or description (`<= 300` characters, trimmed). |
| `clientTransactionId` | `string` | No (`8..128` chars) | Client-generated idempotency identifier per submission intent. |

---

## Authentication / Scope

Authentication and scope enforcement are resolved strictly on the server:
1. **Session Resolution**: Route handlers (`src/app/api/v1/transactions/route.ts`, `src/app/api/v1/hq/dashboard/route.ts`) and Server Actions (`src/app/hq/actions.ts`) resolve the caller's `SessionContext` via `createAuthPort().resolveSession()` (`src/server/auth/port.ts`). Missing sessions are rejected with `401 UNAUTHENTICATED`.
2. **Role & Scope Check**: `resolveAuthorizedOutlet(session, outletId)` in `src/features/sales/index.ts` looks up the target stall/location in `repositories.stalls` / `repositories.sellingLocations`, verifies organization ownership (`stall.organizationId === session.organizationId`), builds a stall-level resource scope, and invokes `authorize(session, "sale:create", targetScope)`.
3. **Unauthorized Outlet Rejection**:
   - Cross-organization outlets (`ST-EXT-99` in organization `...0099`) are rejected with `403 FORBIDDEN`.
   - Stall-scoped operators (`OPERATOR` scoped to `ST-001`) attempting to write a transaction to another stall (`ST-002`) in the same organization are rejected with `403 FORBIDDEN`.
   - Non-existent outlet UUIDs are rejected with `404 NOT_FOUND`.
4. **Mass-Assignment Protection**: Protected fields (`organizationId`, `operatorId`, `shiftId`, `businessDay`, `serverAcceptedAt`, `createdAt`, `status`, `paymentStatus`, and audit actor fields) are derived exclusively on the server and never accepted from client payloads.

---

## Validation

Validation is enforced at two layers:
1. **Client-Side Validation (`src/app/hq/HQDashboardClient.tsx`)**:
   - Verifies non-empty `outletId` selection from `dashboard.authorizedOutlets`.
   - Verifies `amount` is a finite, positive integer within `1..100_000_000` (no `0`, negative, decimal, `NaN`, or `Infinity`).
   - Verifies optional `occurredAt` parses as a valid date not in the future.
   - Verifies optional `note` length `<= 300` characters.
   - Preserves user input on error and displays field-level feedback (`data-testid="error-outletId"`, `data-testid="error-amount"`, `data-testid="error-occurredAt"`, `data-testid="error-note"`).
2. **Server-Side Contract & Domain Validation (`src/shared/contracts/sales.ts` & `src/features/sales/index.ts`)**:
   - `recordTransactionRequestSchema.safeParse(rawInput)` validates all fields and returns structured `400 VALIDATION_FAILED` errors with `fieldErrors`.
   - `money(parsed.amount, "IDR")` (`src/shared/money/money.ts`) enforces `Number.isInteger` and `Number.isSafeInteger` so all monetary math uses integer minor units without floating-point drift.

---

## Domain Write Path

The authoritative write path flows through:
1. **UI Trigger**: User clicks `+ Catat Transaksi` in `src/app/hq/HQDashboardClient.tsx`, fills out the modal form, and submits.
2. **Server Boundary**: `POST /api/v1/transactions` (`src/app/api/v1/transactions/route.ts`) or `submitTransactionAction` (`src/app/hq/actions.ts`).
3. **Application / Domain Service**: `recordTransaction(session, rawInput, options)` in `src/features/sales/index.ts`:
   - Validates input against `recordTransactionRequestSchema`.
   - Resolves and authorizes the target outlet (`resolveAuthorizedOutlet`).
   - Wraps execution in `withIdempotency` (`src/server/db/idempotency.ts`).
   - Resolves the active `OPEN` shift for the stall (or creates an open shift if none is open for the authorized stall).
   - Computes the Jakarta business day (`toJakartanBusinessDay(occurredAt)` with `04:00 WIB` cutoff).
4. **Repository Layer**: `repositories.sales.createTransaction(session.scope, ...)` in `src/server/db/repository.ts`:
   - Creates the `StoredSale` (`status: "COMPLETED"` for `"CASH"`, `"PENDING_PAYMENT"` for unverified digital methods), `StoredSaleItem`, `StoredPayment` (`status: "PAID"` for `"CASH"`, `"PENDING_VERIFICATION"` for digital), and append-only `StoredAuditEvent` entries (`"sale.created"` and `"payment.recorded"`).

---

## Persistence

Persistence is managed by `src/server/db/memory-store.ts`:
- Every mutation to wrapped store `Map`s (`sales`, `saleItems`, `payments`, `idempotency`, `shifts`, etc.) and `auditEvents` triggers `persistStore()`, which serializes all store collections and writes atomically to `<cwd>/data/db.json` via temporary file (`db.json.tmp.<pid>`) + `fs.renameSync`.
- `syncFromDiskIfNeeded()` checks `data/db.json` modification time (`mtimeMs`) before repository and read-model queries so all Next.js server workers stay synchronized.
- During automated test runs (`VITEST` or `NODE_ENV === "test"`), `getDbPath()` returns `null` unless `SIOMAYOPS_DB_PATH` is explicitly set, preventing unit/integration test `memoryStore.clear()` calls from clobbering the runtime `data/db.json`.

---

## Idempotency

Duplicate submissions (double-clicks, network retries, slow connections) are prevented at three levels:
1. **Client UI Lock & Stable Intent Key**: `HQDashboardClient.tsx` generates a UUID `clientTransactionId` when opening the modal, sends it in both the `Idempotency-Key` HTTP header and `clientTransactionId` body field, disables the submit button while `formStatus === "submitting"`, and guards `handleSubmit` with a synchronous `submittingLockRef`. The key is rotated only after a successful write or fresh modal open.
2. **Server Idempotency Store & In-Flight Lock**: `withIdempotency` (`src/server/db/idempotency.ts`) hashes the canonical request payload (SHA-256) and keys by `${organizationId}|POST /api/v1/transactions|${idempotencyKey}`. Concurrent requests with the same key await the in-flight promise (`inFlightRequests`), and subsequent retries return the stored response with `replayed: true` (and `HTTP 200` + `X-Idempotent-Replayed: true`). Reusing a key with a modified payload throws `422 IDEMPOTENCY_MISMATCH`.
3. **Repository Client-ID Deduplication**: `repositories.sales.createTransaction` also checks `memoryStore.saleByClientId` so any repeated `clientSaleId` resolves to the existing sale and payment records without double-counting.

---

## Dashboard Revalidation

After `recordTransaction` commits:
1. Both `POST /api/v1/transactions` and `submitTransactionAction` invoke `revalidatePath("/hq")` and `revalidatePath("/")`.
2. `getDashboardReadModel(session)` (`src/features/hq/index.ts`) recomputes all dashboard metrics from the persisted store:
   - `sales.totalSales` (`Money`), `sales.count` (completed transaction count), and `sales.grossByMethod` (`CASH`, `DIGITAL_VERIFIED`, `DIGITAL_UNVERIFIED`)
   - `cashPosition.expectedCash` (`openingCash + cashSales - cashExpenses`)
   - `outlets`: per-outlet `transactionCount` and `totalSales` (`ST-001 — Alun-alun Bandung`, `ST-002 — Cabang Dago Atas`)
   - `recentActivity`: reverse-chronological list of recorded transactions with `id`, `outletName`, `operatorName`, `amount`, `paymentMethod`, `paymentStatus`, `note`, and `occurredAt`
3. `HQDashboardClient` updates its state strictly from the server-returned `DashboardReadModel` and triggers `router.refresh()` so the Server Component tree (`src/app/hq/page.tsx`, configured with `export const dynamic = "force-dynamic"`) stays in sync.

---

## Runtime Evidence

Executed against the live Next.js server (`http://localhost:3000/hq` and `POST /api/v1/transactions`) using distinctive amount **`Rp 85.137`** (`85137` minor units) on outlet **`ST-001 — Alun-alun Bandung`** (`00000000-0000-7000-0000-000000000020`):

| Metric | Before Write | Immediately After Write (`Rp 85.137`) | After Browser Reload (`GET /hq`) | After Server Restart (New Process) |
| --- | --- | --- | --- | --- |
| **Total Sales (`Penjualan Hari Ini`)** | `Rp 60.000` (`60000`) | `Rp 145.137` (`145137`) | `Rp 145.137` (`145137`) | `Rp 145.137` (`145137`) |
| **Transaction Count (`Transaksi`)** | `2` | `3` | `3` | `3` |
| **Expected Cash (`Posisi Kas`)** | `Rp 160.000` (`160000`) | `Rp 245.137` (`245137`) | `Rp 245.137` (`245137`) | `Rp 245.137` (`245137`) |
| **Target Outlet (`ST-001 — Alun-alun Bandung`)** | `Rp 60.000` (`2 transaksi`) | `Rp 145.137` (`3 transaksi`) | `Rp 145.137` (`3 transaksi`) | `Rp 145.137` (`3 transaksi`) |
| **Other Outlet (`ST-002 — Cabang Dago Atas`)** | `Rp 0` (`0 transaksi`) | `Rp 0` (`0 transaksi`) | `Rp 0` (`0 transaksi`) | `Rp 0` (`0 transaksi`) |
| **Latest Activity (`Aktivitas Terbaru[0]`)** | `7a3e32e8` • `Rp 30.000` • `ST-001` | `62959886` • `Rp 85.137` • `ST-001` • `Catat Transaksi Bukti Runtime Rp 85.137` | `62959886` • `Rp 85.137` • `ST-001` • `Catat Transaksi Bukti Runtime Rp 85.137` | `62959886` • `Rp 85.137` • `ST-001` • `Catat Transaksi Bukti Runtime Rp 85.137` |

- **Persisted Record in `data/db.json`**:
  - `saleId`: `"62959886-6943-4497-bf35-2f72a1828da5"`, `totalMinor: 85137`, `status: "COMPLETED"`, `stallId: "00000000-0000-7000-0000-000000000020"`, `note: "Catat Transaksi Bukti Runtime Rp 85.137"`
  - `paymentId`: `"c1d3cf1d-9d2b-4c8a-9eb2-3eaa802fc79a"`, `method: "CASH"`, `amountMinor: 85137`, `status: "PAID"`
  - `idempotency`: `"00000000-0000-7000-0000-000000000001|POST /api/v1/transactions|runtime-proof-85137-001"`
- **Duplicate Submission Proof**:
  - Re-POSTing the identical payload with `Idempotency-Key: runtime-proof-85137-001` both before and after server restart returned `HTTP 200`, header `X-Idempotent-Replayed: true`, `replayed: true`, and the same `saleId: "62959886-6943-4497-bf35-2f72a1828da5"`, keeping `sales.count = 3` and `totalSales = 145137`.

---

## Tests

Added `tests/integration/transaction-write-flow.test.ts` (13 integration tests across 7 describe blocks):
1. Authorized creation, audit trail (`sale.created`, `payment.recorded`), and mass-assignment protection against forged `organizationId`/`operatorId`/`status`/`createdAt`.
2. Unauthorized outlet rejection (`403 FORBIDDEN` for cross-org stall `ST-EXT-99`, `403 FORBIDDEN` for stall-scoped operator writing to `ST-002`, `404 NOT_FOUND` for unknown UUID, and scoped `getAuthorizedOutlets`).
3. Input validation edge cases (`0`, negative, decimal, `NaN`, `Infinity`, `> 100_000_000`, empty `outletId`, invalid/future `occurredAt`, and `> 300` char `note`).
4. Dashboard read model (`getDashboardReadModel`) KPI updates (`totalSales`, `count`, `expectedCash`, per-outlet aggregation, and `recentActivity`).
5. Idempotency and duplicate submission protection (sequential replay, concurrent `Promise.all` deduplication, and `422 IDEMPOTENCY_MISMATCH` on altered payload).
6. File-backed persistence (`SIOMAYOPS_DB_PATH`) and simulated process restart via `memoryStore.reloadFromDisk()`.
7. HTTP route handler integration (`POST /api/v1/transactions`, `GET /api/v1/transactions`, and `GET /api/v1/hq/dashboard`).

---

## Remaining Gaps

- **Expense Creation (`Catat Pengeluaran`)**: Recording operational expenses end-to-end with expense KPI updates, per-outlet expense aggregation, and recent activity feed integration is not yet wired into this dashboard flow.
- **CSV / Report Export**: Exporting filtered dashboard sales/expenses is not yet implemented.
- **Canonical `T-HQ-003` Multi-Filter & Freshness Drill-Down**: While `getDashboardReadModel`, `GET /api/v1/hq/dashboard`, and `GET /api/v1/hq/sales` now expose live sales, cash position, per-outlet aggregation, and recent activity, full `T-HQ-003` completion remains open pending end-to-end expense aggregation and multi-dimensional filter controls on the HQ view.
