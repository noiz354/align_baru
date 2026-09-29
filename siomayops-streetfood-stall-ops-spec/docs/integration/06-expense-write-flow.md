# 06 — Expense Write Flow (`Catat Pengeluaran`)

## Previous State

Prior to this vertical slice:
1. `src/app/hq/HQDashboardClient.tsx` had no **Catat Pengeluaran** action modal, did not display total operational expenses or cash-box expense deductions in `Pengeluaran & Antrian Review`, did not show per-outlet expense counts and totals in the outlet breakdown table, and did not surface recorded expenses in `Aktivitas Terbaru`.
2. `src/app/expenses/page.tsx` submitted `categoryId` without `categoryCode` and `amount: { amountMinor, currency }` to `POST /api/v1/expenses`, which previously failed schema validation because `CreateExpenseSchema` required `categoryCode` and top-level `amountMinor`.
3. `src/app/hq/expenses/page.tsx` rendered a hardcoded placeholder row (`EXP-001`, `SH-001`, `Rp 50.000`) instead of querying persisted expenses.
4. `src/server/db/repository.ts` had no scoped `expenses` repository, and `src/features/expenses/index.ts` did not enforce server-side outlet authorization (`resolveAuthorizedOutlet` + `authorize(session, "expense:submit", targetScope)`) or unified idempotency with cross-worker persistence.

---

## Input Contract

The expense write contract is defined in `src/shared/contracts/expenses.ts` (`recordExpenseRequestSchema` / `RecordExpenseRequest`):

| Field | Type | Required | Description / Constraints |
| --- | --- | --- | --- |
| `outletId` | `string` (UUID) | Yes | Target authorized stall (`stallId`) or selling location (`sellingLocationId`) UUID (or resolved from `shiftId`). |
| `categoryCode` | `"TRANSPORT" \| "PARKING" \| "CLEANING" \| "CONSUMABLE" \| "REPAIR_MINOR" \| "UNVERIFIED_FIELD_EXPENSE" \| "OTHER_OPERATIONAL"` | Yes | Neutral operational expense category (no recipient identity or authority fields per ADR-0027). |
| `amount` | `number` (integer) | Yes | Positive safe integer in IDR minor units (`1..50_000_000`, i.e., `Rp 1` to `Rp 50.000.000`). |
| `description` | `string` | Yes | Short operational description (`3..300` characters, trimmed). |
| `paidFrom` | `"CASH_BOX" \| "PERSONAL"` | No (defaults to `"CASH_BOX"`) | Funding source (`"CASH_BOX"` reduces expected shift cash; `"PERSONAL"` is operator-funded). |
| `incurredAt` | `string` (ISO-8601) | No (defaults to server timestamp) | Business timestamp of expense; must be valid ISO-8601 and not in the future (`<= now + 5 min`). |
| `note` | `string` | No | Optional note (`<= 300` characters, trimmed). |
| `evidenceAssetId` | `string` | No | Optional evidence asset reference. |
| `clientExpenseId` | `string` | No (`8..128` chars) | Client-generated idempotency identifier per submission intent. |

---

## Authentication / Scope

Authentication and scope enforcement are resolved strictly on the server:
1. **Session Resolution**: `POST /api/v1/expenses` (`src/app/api/v1/expenses/route.ts`) and `submitExpenseAction` (`src/app/hq/actions.ts`) resolve `SessionContext` via `createAuthPort().resolveSession()` (`src/server/auth/port.ts`). Unauthenticated callers are rejected with `401 UNAUTHENTICATED`.
2. **Role & Scope Check**: `recordExpense` (`src/features/expenses/index.ts`) verifies `authorize(session, "expense:submit", session.scope)` and resolves the target outlet via `resolveAuthorizedOutlet(session, outletId, correlationId)`, then enforces `authorize(session, "expense:submit", targetScope)` against the stall scope.
3. **Unauthorized Outlet Rejection**:
   - Cross-organization outlets (`ST-EXT-99` in organization `...0099`) are rejected with `403 FORBIDDEN` and audited (`authz.denied`).
   - Stall-scoped operators (`OPERATOR` scoped to `ST-001`) attempting to record an expense on another stall (`ST-002`) in the same organization are rejected with `403 FORBIDDEN` and audited (`authz.denied`).
   - Non-existent outlet UUIDs are rejected with `404 NOT_FOUND`.
4. **Mass-Assignment Protection**: Protected fields (`organizationId`, `operatorId`, `shiftId`, `stallId`, `sellingLocationId`, `businessDay`, `reviewStatus`, `flaggedReason`, `reviewedBy`, `reviewedAt`, `createdAt`, and audit actor fields) are derived exclusively on the server; forged client fields are ignored.

---

## Validation

Validation is enforced at two layers:
1. **Client-Side Validation (`src/app/hq/HQDashboardClient.tsx` & `src/app/expenses/page.tsx`)**:
   - Verifies `outletId` is selected from `dashboard.authorizedOutlets`.
   - Verifies `categoryCode` is one of the 7 neutral categories.
   - Verifies `amount` is a finite positive integer (`1..50_000_000`) and rejects `0`, negative numbers, decimals, `NaN`, and `Infinity`.
   - Verifies `description` is `3..300` characters after trimming.
   - Verifies optional `incurredAt` is a valid date not in the future.
   - Verifies optional `note` is `<= 300` characters.
   - Preserves entered form values on failure and displays field-level feedback (`data-testid="error-exp-outletId"`, `data-testid="error-exp-categoryCode"`, `data-testid="error-exp-amount"`, `data-testid="error-exp-description"`, `data-testid="error-exp-incurredAt"`, `data-testid="error-exp-note"`).
2. **Server-Side Contract & Domain Validation (`src/shared/contracts/expenses.ts` & `src/features/expenses/index.ts`)**:
   - `recordExpenseRequestSchema.safeParse(normalizedCandidate)` validates all fields and returns `400 VALIDATION_FAILED` with structured `fieldErrors`.
   - `money(input.amount, "IDR")` (`src/shared/money/money.ts`) enforces integer minor units (`Number.isInteger` and `Number.isSafeInteger`).

---

## Domain Write Path

1. **UI Trigger**: User clicks `+ Catat Pengeluaran` on `/hq` (`src/app/hq/HQDashboardClient.tsx`) or submits from `/expenses` (`src/app/expenses/page.tsx`).
2. **Server Boundary**: `POST /api/v1/expenses` (`src/app/api/v1/expenses/route.ts`) or `submitExpenseAction` (`src/app/hq/actions.ts`).
3. **Domain / Feature Service**: `recordExpense(session, rawInput, options)` (`src/features/expenses/index.ts`):
   - Validates input against `recordExpenseRequestSchema`.
   - Resolves and authorizes the target outlet (`resolveAuthorizedOutlet`).
   - Evaluates neutral record-level flag patterns (`matchesFlagPattern` from `src/domain/expense/review.ts`: `HIGH_AMOUNT`, `NO_EVIDENCE_HIGH`, `ROUND_AMOUNT`, `REPEATED_UNVERIFIED`). Pattern matches set `reviewStatus = "REVIEW_REQUIRED"` and `flaggedReason` on the expense record (never attached to a person, and never auto-rejecting).
   - Wraps execution in `withIdempotency`.
4. **Repository Layer**: `repositories.expenses.createExpense(session.scope, storedExpense)` (`src/server/db/repository.ts`) stores the `StoredExpense`, indexes `expenseByClientId`, writes append-only `StoredAuditEvent` entries (`expense.submitted` and optional `expense.flagged`), and flushes to disk via `persistNow()`.

---

## Persistence

Persistence is handled by `src/server/db/memory-store.ts`:
- `memoryStore.expenses` and `memoryStore.expenseByClientId` are wrapped for automatic atomic persistence (`db.json.tmp.<pid>` + `fs.renameSync`) to `<cwd>/data/db.json`.
- `syncFromDiskIfNeeded()` reloads `data/db.json` when modified so all server workers read the latest state.
- Under `VITEST` / `NODE_ENV === "test"`, `getDbPath()` returns `null` unless `SIOMAYOPS_DB_PATH` is explicitly set, isolating runtime `data/db.json` from test runs.

---

## Idempotency

Duplicate submissions are prevented at three levels:
1. **Client UI Lock & Stable Intent Key**: `HQDashboardClient.tsx` and `ExpensesPage` generate a UUID `clientExpenseId` per submission intent, pass it in `Idempotency-Key` and `clientExpenseId`, disable the submit button while `expFormStatus === "submitting"`, and guard submission with `expSubmittingLockRef`.
2. **Server Idempotency Store & In-Flight Lock**: `withIdempotency` (`src/server/db/idempotency.ts`) hashes the canonical expense payload (SHA-256) and keys by `${organizationId}|POST /api/v1/expenses|${idempotencyKey}`. Concurrent requests share the in-flight promise, sequential retries return `replayed: true` (`HTTP 200` + `X-Idempotent-Replayed: true`), and payload mismatches return `422 IDEMPOTENCY_MISMATCH`.
3. **Repository Client-ID Deduplication**: `repositories.expenses.findByClientId` ensures repeated `clientExpenseId` values resolve to the existing `StoredExpense`.

---

## Dashboard Revalidation

After `recordExpense` commits:
1. `POST /api/v1/expenses` and `submitExpenseAction` call `revalidatePath("/hq")`, `revalidatePath("/hq/expenses")`, `revalidatePath("/expenses")`, and `revalidatePath("/")`.
2. `getDashboardReadModel(session)` (`src/features/hq/index.ts`) recomputes from persisted data:
   - `expenses.totalExpenses`, `expenses.cashBoxExpenses`, `expenses.personalExpenses`, `expenses.count`, `expenses.pendingReviewCount`, and `expenses.flaggedCount`
   - `cashPosition.cashExpenses` and `cashPosition.expectedCash` (`openingCash + cashSales - cashBoxExpenses`)
   - `outlets`: per-outlet `expenseCount`, `totalExpenses`, and `cashBoxExpenses` alongside `transactionCount` and `totalSales`
   - `recentActivity`: unified reverse-chronological feed of both `"SALE"` and `"EXPENSE"` records
3. `HQDashboardClient` updates its state from the server-returned `DashboardReadModel` and triggers `router.refresh()`.

---

## Runtime Evidence

Executed against the live Next.js server (`http://localhost:3000/hq` and `POST /api/v1/expenses`) using distinctive amount **`Rp 37.450`** (`37450` minor units, category `"CONSUMABLE"`, `paidFrom: "CASH_BOX"`) on outlet **`ST-001 — Alun-alun Bandung`** (`00000000-0000-7000-0000-000000000020`):

| Metric | Before Expense Write | Immediately After Write (`Rp 37.450`) | After Browser Reload (`GET /hq`) | After Server Restart (New Process) |
| --- | --- | --- | --- | --- |
| **Total Expenses (`Total Pengeluaran`)** | `Rp 0` (`0`) | `Rp 37.450` (`37450`) | `Rp 37.450` (`37450`) | `Rp 37.450` (`37450`) |
| **Expense Count (`Pengeluaran tercatat`)** | `0` | `1` | `1` | `1` |
| **Cash Box Expenses (`Dari Kotak Kas`)** | `Rp 0` (`0`) | `Rp 37.450` (`37450`) | `Rp 37.450` (`37450`) | `Rp 37.450` (`37450`) |
| **Expected Cash (`Posisi Kas — Diharapkan`)** | `Rp 245.137` (`245137`) | `Rp 207.687` (`207687`) | `Rp 207.687` (`207687`) | `Rp 207.687` (`207687`) |
| **Target Outlet (`ST-001 — Alun-alun Bandung`)** | `Rp 0` (`0 pengeluaran`) | `Rp 37.450` (`1 pengeluaran`) | `Rp 37.450` (`1 pengeluaran`) | `Rp 37.450` (`1 pengeluaran`) |
| **Other Outlet (`ST-002 — Cabang Dago Atas`)** | `Rp 0` (`0 pengeluaran`) | `Rp 0` (`0 pengeluaran`) | `Rp 0` (`0 pengeluaran`) | `Rp 0` (`0 pengeluaran`) |
| **Latest Activity (`Aktivitas Terbaru[0]`)** | `SALE` • `62959886` • `Rp 85.137` • `ST-001` | `EXPENSE` • `44c4c8db` • `CONSUMABLE` • `Rp 37.450` • `ST-001` | `EXPENSE` • `44c4c8db` • `CONSUMABLE` • `Rp 37.450` • `ST-001` | `EXPENSE` • `44c4c8db` • `CONSUMABLE` • `Rp 37.450` • `ST-001` |

- **Persisted Record in `data/db.json`**:
  - `expenseId`: `"44c4c8db-0e6e-49bb-9422-04a4f2ded31d"`, `amountMinor: 37450`, `category: "CONSUMABLE"`, `paidFrom: "CASH_BOX"`, `reviewStatus: "SUBMITTED"`, `stallId: "00000000-0000-7000-0000-000000000020"`, `description: "Pembelian gas LPG 3kg & plastik kemasan"`, `note: "Catat Pengeluaran Bukti Runtime Rp 37.450"`
  - `idempotency`: `"00000000-0000-7000-0000-000000000001|POST /api/v1/expenses|runtime-proof-exp-37450-001"`
- **Duplicate Submission Proof**:
  - Re-POSTing the identical payload with `Idempotency-Key: runtime-proof-exp-37450-001` both before and after server restart returned `HTTP 200`, header `X-Idempotent-Replayed: true`, `replayed: true`, and the same `expenseId: "44c4c8db-0e6e-49bb-9422-04a4f2ded31d"`, keeping `expenses.count = 1`, `totalExpenses = 37450`, and `expectedCash = 207687`.

---

## Tests

Added `tests/integration/expense-write-flow.test.ts` (13 integration tests across 7 describe blocks):
1. Authorized creation, append-only audit trail (`expense.submitted`), record-level pattern flagging (`ROUND_AMOUNT` -> `REVIEW_REQUIRED`), and mass-assignment protection against forged `organizationId`/`operatorId`/`reviewStatus`/`reviewedBy`/`createdAt`.
2. Unauthorized outlet rejection (`403 FORBIDDEN` for cross-org stall `ST-EXT-99`, `403 FORBIDDEN` for stall-scoped operator writing to `ST-002`, `404 NOT_FOUND` for unknown UUID).
3. Input validation edge cases (`0`, negative, decimal, `NaN`, `Infinity`, `> 50_000_000`, invalid `categoryCode`, short `description`, invalid/future `incurredAt`, and `> 300` char `note`).
4. Dashboard read model (`getDashboardReadModel`) KPI updates (`expenses.totalExpenses`, `expenses.cashBoxExpenses`, `expenses.count`, `cashPosition.cashExpenses`, `cashPosition.expectedCash`, per-outlet expense aggregation, and `recentActivity` union).
5. Idempotency and duplicate submission protection (sequential replay, concurrent `Promise.all` deduplication, and `422 IDEMPOTENCY_MISMATCH` on altered payload).
6. File-backed persistence (`SIOMAYOPS_DB_PATH`) and simulated process restart via `memoryStore.reloadFromDisk()`.
7. HTTP route handler integration (`POST /api/v1/expenses`, `GET /api/v1/expenses`, `GET /api/v1/hq/expense-review`, and `GET /api/v1/hq/dashboard`).

---

## Remaining Gaps

- **Interactive HQ Expense Review Transitions**: Submitting `REVIEWED` / `REJECTED` / `ESCALATED` decisions with mandatory reason from `/hq/expenses` UI (enforcing reviewer ≠ submitter).
- **CSV / Report Export**: Exporting filtered dashboard sales and expenses.
- **Multi-Dimensional HQ Filtering**: Filtering the HQ dashboard cards and tables by custom date range, area, or stall filter controls.
