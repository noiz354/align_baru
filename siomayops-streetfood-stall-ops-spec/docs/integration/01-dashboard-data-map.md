# Dashboard Data Map (Design Baseline)

> This is the original contract/design baseline. Implementation status and source/runtime evidence are maintained in `01-dashboard-ground-truth.md`, `01-dashboard-architecture.md`, and `01-dashboard-gap-report.md`.

**Document ID:** DOC-INT-DASHBOARD-DATA-MAP-01  
**Target Surface:** Redesigned HQ Dashboard (`src/app/hq/page.tsx` & `/` HQ summary entrypoint)  
**Specification References:** `HQ.md`, `docs/product/HQ-DASHBOARD.md`, `TASKS.md` (T-HQ-003), `DESIGN.md` §4/§10, `DATA_MODEL.md`, ADR-0006, ADR-0010, ADR-0016, ADR-0026, ADR-0027, ADR-0030, ADR-0031, ADR-0033  
**Status:** Data-Contract Design Only (Read-Model Specification)  

---

## 1. Dashboard Inventory

Inspection of the dashboard surface (including current landing `src/app/page.tsx`, HQ dashboard at `src/app/hq/page.tsx`, alerts at `src/app/alerts/page.tsx`, and the target redesign specification in `docs/product/HQ-DASHBOARD.md` / `TASKS.md` T-HQ-003) reveals the following inventory of visible dashboard elements:

### 1.1 KPI Headline Cards
1. **Penjualan Hari Ini (Today's Gross Sales):** Total gross sales amount in IDR for the current business day.
2. **Jumlah Transaksi (Transaction Count):** Total count of completed customer sales in the current business day.
3. **Rata-rata Transaksi (Average Transaction Value):** Derived average revenue per transaction (`sales / transactionCount`).
4. **Pengeluaran (Today's Expenses):** Total approved/incurred operational expenses in the business day.
5. **Rasio Pengeluaran (Expense Ratio):** Derived percentage/ratio of expenses relative to gross sales (`expenses / sales`).
6. **Outlet / Gerobak Aktif (Active Outlets / Stalls):** Count of stalls currently running an active, open shift.
7. **Total Outlet / Gerobak (Total Outlets / Stalls):** Total registered stalls in the organization/scope.

### 1.2 Sales Chart / Trend
- **Hourly Sales Trend:** Aggregation of gross sales grouped into hourly buckets (`00:00` to `23:00` local business day).
- **Selected Day / Date Indicator:** Local business day string (defaulting to current `YYYY-MM-DD` in `Asia/Jakarta`).

### 1.3 Outlet Summary Table
- **Outlet / Stall Name & Code:** Identifier of the stall (e.g., `ST-001`).
- **Operator Name:** Assigned or active operator conducting the shift.
- **Mulai (Shift Start Time):** Timestamp when the current shift was opened.
- **Sales (Penjualan Stall):** Scoped sales volume attributed to the shift/stall.
- **Expenses (Pengeluaran Stall):** Scoped recorded cash expenses from the stall's cash box.
- **Status Operasional:** Operational state (`ACTIVE`, `IDLE`, `CLOSING_SUBMITTED`, `CLOSED_ACCEPTED`, `SUSPENDED`).

### 1.4 Operational Alerts
- **Outlet Not Started / Terlambat Buka:** Stall without an active shift past expected operating hours.
- **Tinggi Rasio Pengeluaran (High Expense Ratio):** Shift/stall expense ratio exceeding operating limits.
- **Stok Menipis / Habis (Low / Depleted Stock):** Critical inventory items below minimum threshold.
- **Insiden Belum Selesai (Unresolved Incidents):** Open or critical operational incidents awaiting resolution.
- **Tanpa Laporan Lokasi (Shift Active Without Location Report):** Shift open > 30 min with no active location check-in.
- **Antrian Verifikasi Pembayaran (Pending Digital Payment Verification):** QRIS payments awaiting HQ audit.

### 1.5 Recent Activity Feed
- Event items showing recent operational actions:
  - `sale.created` / `sale.completed`
  - `expense.submitted` / `expense.flagged`
  - `shift.started` / `shift.closed`
  - `price.policy_published` / `price.acknowledged`
  - `incident.submitted`

---

## 2. Authoritative Sources

| UI Field / Component | Domain Source | Persistence Source | Calculation / Derivation Rule | Scope | Derived? | Existing in Code? | Implementation Gap |
|---|---|---|---|---|---|---|---|
| **Penjualan Hari Ini** | `Sale` entity | `memoryStore.sales` / PostgreSQL `sales` table | Sum of `totalMinor` for sales where `organizationId = scope.orgId`, `businessDay = scope.businessDay`, and `status = 'COMPLETED'` | `organizationId`, optional `areaId`/`stallId`, `businessDay` | Yes (sum) | Partial (`getSalesCard` in `hq/index.ts`) | Only aggregates in-memory; missing area/outlet query scoping; split of verified vs unverified digital not surfaced on single KPI card |
| **Jumlah Transaksi** | `Sale` entity | `memoryStore.sales` / PostgreSQL `sales` table | Count of distinct completed `saleId` records in business day | `organizationId`, optional `stallId`, `businessDay` | Yes (count) | Partial (`getSalesCard`) | No consolidated unified read model endpoint |
| **Rata-rata Transaksi** | `Sale` entity | Derived from `sales` | `totalSales.amountMinor / transactionCount` (returns `0` if count = 0) | Scoped to query | Yes | No | Formula not evaluated in read-model layer; UI computes ad-hoc |
| **Pengeluaran Hari Ini** | `Expense` entity | `memoryStore.expenses` / PostgreSQL `expenses` table | Sum of `amountMinor` for expenses where `shift.businessDay = scope.businessDay` and `reviewStatus != 'REJECTED'` | `organizationId`, optional `shiftId`/`stallId`, `businessDay` | Yes (sum) | Partial (`listExpensesForReview`) | Expenses table stores `incurredAt` timestamp; missing direct `businessDay` column (must join with `shifts` or compute from `incurredAt`) |
| **Rasio Pengeluaran** | `Expense` & `Sale` | Derived from `expenses` & `sales` | `(expensesTotalMinor / salesTotalMinor) * 100` (returns `null` or `0%` if `salesTotalMinor == 0`) | Scoped to query | Yes | No | Not implemented in any read model |
| **Outlet Aktif** | `Shift` & `Stall` | `memoryStore.shifts`, `memoryStore.stalls` / DB `shifts` | Count of stalls with a shift having `businessDay = target` and `status IN ('OPEN', 'PENDING_SYNC')` | `organizationId` | Yes | Partial (`getCoverageCard`) | Direct join to stall metadata not consolidated |
| **Total Outlet** | `Stall` entity | `memoryStore.stalls` / PostgreSQL `stalls` table | Count of stalls where `organizationId = scope.orgId` and `status != 'DECOMMISSIONED'` | `organizationId`, optional `areaId` | Yes (count) | Partial (iterates `stalls`) | No indexed stall summary query |
| **Sales Chart (Hourly)** | `Sale` entity | `memoryStore.sales` / PostgreSQL `sales` table | Group completed sales by `hour(occurredAt in Asia/Jakarta)` from 00 to 23; fill missing hours with 0 | `organizationId`, optional `stallId`, `businessDay` | Yes (bucketed) | No | Missing hourly aggregation service and bucket projector |
| **Outlet Table: Name/Code** | `Stall` entity | `memoryStore.stalls` / PostgreSQL `stalls` table | Direct projection of `stalls.code` and `stalls.type` | `organizationId`, `areaId` | Stored | Partial | In-memory only; no dedicated outlet overview projection |
| **Outlet Table: Operator** | `Operator` / `Shift` | `memoryStore.shifts`, `memoryStore.operators` | Look up `operators.name` via active `shift.operatorId` | `shiftId` | Stored / Joined | Partial | Currently hardcoded in UI test strings ("Budi"); needs dynamic join |
| **Outlet Table: Mulai (Start Time)** | `Shift` entity | `memoryStore.shifts.startedAt` | Format `shift.startedAt` to `HH:mm` in `Asia/Jakarta` | `shiftId` | Stored | Partial | Shift entity has `startedAt`, but table row model is missing |
| **Outlet Table: Sales** | `Sale` entity | `memoryStore.sales` | Sum of `totalMinor` for `shiftId` where `status = 'COMPLETED'` | `shiftId` | Derived | Partial | Calculated inline in some places; no unified outlet row projection |
| **Outlet Table: Expenses** | `Expense` entity | `memoryStore.expenses` | Sum of `amountMinor` for `shiftId` where `paidFrom = 'CASH_BOX'` | `shiftId` | Derived | Partial | Incurred cash expenses for shift exist but not projected into table |
| **Outlet Table: Status** | `Shift` & `Stall` | `memoryStore.shifts.status`, `stalls.status` | Operational state: `ACTIVE`, `IDLE`, `CLOSING_SUBMITTED`, `SUSPENDED` | `stallId` | Derived | Partial | Status is scattered between stall and active shift records |
| **Alert: Outlet Not Started** | `Shift` & `Stall` | `stalls` and `shifts` | Stall has no active shift and local time > opening threshold (e.g., 07:30 WIB) | `organizationId` | Derived Rule | Partial (`stallsIdle` exists) | Opening schedule threshold not defined in schema |
| **Alert: High Expense Ratio** | `Expense` & `Sale` | `expenses` and `sales` | Derived ratio exceeds configured threshold (e.g. > 35%) | `shiftId` / `stallId` | Derived Rule | No | Threshold rule not formally declared in config |
| **Alert: Low Stock** | `StockSnapshot` / `StockMovement` | `memoryStore.stockMovements`, `stockItems` | Current calculated quantity <= reorder threshold (e.g., < 10) | `organizationId`, `stallId` | Derived Rule | Partial (hardcoded in `HQPage` < 10) | Per-item threshold schema missing; hardcoded in prototype |
| **Alert: Unresolved Incident** | `Incident` entity | `memoryStore.incidents` / PostgreSQL `incidents` | Incidents where `status NOT IN ('RESOLVED', 'CLOSED')` and `severity = 'CRITICAL'` | `organizationId` | Domain Entity | Partial (`getIncidentBoardCard`) | Incident query exists, but alert inbox aggregation is separate |
| **Recent Activity Feed** | `AuditEvent` entity | `memoryStore.auditEvents` / PostgreSQL `audit_events` | Query `audit_events` ordered by `occurredAt DESC LIMIT 20` | `organizationId`, optional `stallId` | Domain Entity Projection | Partial (`listAuditEvents`) | Audit events are recorded; dashboard feed projector not exposed to UI |

---

## 3. KPI Definitions

### 3.1 Penjualan Hari Ini (Today's Gross Sales)
```text
AUTHORITATIVE SOURCE:
Persisted `sales` table (PostgreSQL / memoryStore.sales).

FALLBACK SOURCE:
None. Do not fall back to client cache or uncommitted device state.

DERIVATION:
Sum `sales.totalMinor` where:
- `sales.organizationId = query.organizationId`
- `sales.businessDay = query.businessDay`
- `sales.status = 'COMPLETED'`
- If `query.stallId` is specified, `sales.stallId = query.stallId`

CAN BE CACHED:
Yes, in read-model cache for up to 60 seconds. Must include `computedAt` timestamp and freshness band.
```

### 3.2 Jumlah Transaksi (Transaction Count)
```text
AUTHORITATIVE SOURCE:
Persisted `sales` records.

FALLBACK SOURCE:
None.

DERIVATION:
Count distinct `sales.id` where:
- `sales.organizationId = query.organizationId`
- `sales.businessDay = query.businessDay`
- `sales.status = 'COMPLETED'`

CAN BE CACHED:
Yes, alongside `sales` read model (TTL ≤ 60s).
```

### 3.3 Rata-rata Transaksi (Average Transaction Value)
```text
AUTHORITATIVE SOURCE:
Derived directly from authoritative `sales` and `transactionCount`.

FALLBACK SOURCE:
None.

DERIVATION:
If `transactionCount == 0`:
  `0 IDR`
Else:
  `Math.round(totalSales.amountMinor / transactionCount)` (in integer minor currency units)

CAN BE CACHED:
Yes, computed with the KPI read model.
```

### 3.4 Pengeluaran (Expenses Total)
```text
AUTHORITATIVE SOURCE:
Persisted `expenses` records joined with `shifts`.

FALLBACK SOURCE:
None.

DERIVATION:
Sum `expenses.amountMinor` where:
- `expenses.organizationId = query.organizationId`
- Associated shift has `businessDay = query.businessDay` (or `expenses.incurredAt` falls within the business day window)
- `expenses.reviewStatus != 'REJECTED'` (includes `SUBMITTED`, `REVIEW_REQUIRED`, `REVIEWED`, `ESCALATED`)

CAN BE CACHED:
Yes (TTL ≤ 5 min per ADR and HQ dashboard spec).
```

### 3.5 Rasio Pengeluaran (Expense Ratio)
```text
AUTHORITATIVE SOURCE:
Derived from `expenses` and `sales`.

FALLBACK SOURCE:
None.

DERIVATION:
If `totalSales.amountMinor == 0`:
  `null` (or displayed as 0% / N/A, avoiding divide-by-zero or NaN)
Else:
  `(expensesTotalMinor / totalSalesMinor) * 100` rounded to 1 decimal place.

CAN BE CACHED:
Yes, computed synchronously with dashboard read model.
```

### 3.6 Outlet Aktif & Total Outlet
```text
AUTHORITATIVE SOURCE:
`stalls` joined with `shifts`.

FALLBACK SOURCE:
None.

DERIVATION:
- Total Outlets: Count of `stalls` where `stalls.organizationId = query.organizationId` and `stalls.status != 'DECOMMISSIONED'`.
- Outlet Aktif: Count of distinct `stalls.id` where there is an active shift (`shift.businessDay = query.businessDay` and `shift.status IN ('OPEN', 'PENDING_SYNC')`).

CAN BE CACHED:
Yes (TTL ≤ 60s).
```

---

## 4. Date / Time Semantics

### 4.1 System Timezone Rules (per ADR-0033 & `src/shared/time/business-day.ts`)
- **Application Timezone:** `Asia/Jakarta` (UTC+7, no Daylight Saving Time).
- **Storage Timezone:** UTC ISO-8601 strings or PostgreSQL `timestamptz`.
- **Timestamp Format:** RFC 3339 / ISO 8601 with timezone offset (e.g., `2026-09-29T10:00:00.000Z`).
- **Device Time:** Captured only as `recordedAtDevice` metadata for offline ordering; never used for business day calculation, price resolution, or accounting cut-offs.

### 4.2 Business Day Boundary Resolution
The business day is derived server-side using a configurable cut hour (default **04:00 WIB**):
```text
Cut Hour: 04:00 Asia/Jakarta (04:00 WIB = 21:00 UTC previous calendar day).
```

For target date `2026-09-29`:
- **Local Business Day Range:** `2026-09-29 04:00:00 WIB` to `2026-09-30 04:00:00 WIB`.
- **Persisted UTC Instant Range:**
  - `start`: `2026-09-28T21:00:00.000Z`
  - `end`: `2026-09-29T21:00:00.000Z`

```text
Formula:
businessDayRange("2026-09-29", { timezone: "Asia/Jakarta", cutHour: 4 })
→ { start: 2026-09-28T21:00:00.000Z, end: 2026-09-29T21:00:00.000Z }
```

### 4.3 Historical Date Support
- Historical business days are queried by passing `businessDay: "YYYY-MM-DD"`.
- If `businessDay < currentBusinessDay`:
  - Active outlets metric reflects completed shifts for that day (`CLOSING_SUBMITTED`, `CLOSED_ACCEPTED`).
  - Read model can be cached with extended TTL or marked immutable once closing review is finalized.

---

## 5. Sales KPI Rules

Domain definitions based on `src/domain/sale/totals.ts`, `src/features/sales/index.ts`, and `SALES.md`:

1. **Record Types:** Only records in the `sales` entity.
2. **Qualifying Statuses:**
   - `COMPLETED`: Counted in revenue and transaction count.
   - `DRAFT`: **EXCLUDED** (open cart, awaiting payment).
   - `VOIDED`: **EXCLUDED** (cancelled transaction; excluded from sales total and transaction count; audited in `audit_events`).
   - `CORRECTED`: Post-sale adjustment; uses corrected total snapshot.
3. **Refunds:** Handled via void or price correction domain action. No separate unlinked refund record; voided sales subtract the entire sale.
4. **Discounts:** Discounts are subtracted before computing `payableTotal` in `computeSaleTotalFromSnapshots`:
   ```ts
   payableTotal = linesTotal - discountTotal
   ```
5. **Gross vs Net:**
   - The headline KPI displays **Gross Payable Total** (`payableTotal` from completed sales).
   - In accordance with ADR-0012 and FR-PAYMENT-010, the HQ read model maintains an honest split:
     - `grossCash`: Cash collected.
     - `grossDigitalVerified`: Digital QRIS payments confirmed by callback or HQ approval.
     - `grossDigitalUnverified`: Digital QRIS payments pending verification.
   - The KPI headline must never present unverified digital funds as settled cash.

---

## 6. Transaction Count

1. **Definition of One Transaction:** Exactly one `sale` record with `status = 'COMPLETED'`.
2. **Cancelled / Voided Records:** Excluded from `transactionCount`.
3. **Idempotency & Retries:** Every client sale submission requires a unique `clientSaleId` (UUID v4). Idempotent replay returns the existing `saleId` without incrementing the transaction count.
4. **Entity Basis:** Count is strictly based on the `Sale` aggregate root, not individual `SaleItem` rows and not `Payment` attempts.

---

## 7. Average Transaction Value

1. **Formula:**
   ```ts
   if (transactionCount === 0) {
     return money(0, "IDR");
   }
   return money(Math.round(totalSalesMinor / transactionCount), "IDR");
   ```
2. **Zero-Count Behavior:** Returns `Rp 0` (integer minor units `0`). Division by zero is guarded; never returns `NaN` or `Infinity`.

---

## 8. Expenses & Expense Ratio

1. **Authoritative Entity:** `expenses` table (`src/server/db/schema.ts`, `src/features/expenses/index.ts`).
2. **Status Semantics:**
   - `SUBMITTED`: Valid incurred expense submitted by stall operator; counted in daily operational expense.
   - `REVIEW_REQUIRED` / Flagged: Incurred expense flagged for supervisor review; still counted in tentative expense until rejected.
   - `REVIEWED`: Approved expense; counted.
   - `REJECTED`: Voided/disallowed expense; **excluded** from expense total.
   - `ESCALATED`: Awaiting higher-level review; counted tentatively with audit warning.
3. **Paid From:**
   - `CASH_BOX`: Deducted from physical cash drawer; impacts shift cash reconciliation.
   - `PERSONAL`: Operator out-of-pocket expense requiring reimbursement; does not reduce drawer cash, but is counted in stall total expenses.
4. **Expense Total Definition:**
   ```ts
   expenseTotal = sum(expense.amountMinor) for status in ["SUBMITTED", "REVIEW_REQUIRED", "REVIEWED", "ESCALATED"]
   ```
5. **Expense Ratio Definition:**
   ```ts
   if (salesTotalMinor === 0) {
     return null; // Displayed as "-" or "0.0%" with neutral hint
   }
   return Number(((expenseTotalMinor / salesTotalMinor) * 100).toFixed(1));
   ```

---

## 9. Outlet Operational Status

Per `src/domain/shift/state.ts` and `src/features/shifts/index.ts`, operational state is tied to **explicit shift lifecycle states**, never guessed from transaction timestamps:

| Operational State | Determining Condition | Code Evidence |
|---|---|---|
| `ACTIVE` | Stall has an associated shift in status `OPEN` or `PENDING_SYNC` for the current business day. | `shift.status === 'OPEN' \|\| shift.status === 'PENDING_SYNC'` |
| `IDLE` / `NOT_STARTED` | Stall is registered in the organization (`stalls.status = 'ACTIVE'`) but has no shift started for today. | No shift record exists with `businessDay = today` |
| `CLOSING_SUBMITTED` | Operator has submitted shift closing counts; awaiting HQ review. | `shift.status === 'CLOSING_SUBMITTED'` |
| `CLOSED_ACCEPTED` | Shift closing has been formally reviewed and reconciled by HQ. | `shift.status === 'CLOSED_ACCEPTED'` |
| `SUSPENDED` | Shift was suspended by HQ or supervisor due to weather, inspection, or incident. | `shift.status === 'SUSPENDED'` |
| `INACTIVE` / `DECOMMISSIONED` | Stall hardware itself is out of service or decommissioned. | `stall.status === 'INACTIVE'` |

---

## 10. Outlet Table Column Mapping

| Column Header | Field Name | Authoritative Source Entity | Persistence Path | Calculation / Format | Handling when Unsupported / Null |
|---|---|---|---|---|---|
| **Outlet** | `stallName` | `stalls` | `memoryStore.stalls` (`stalls.code`, `stalls.type`) | String concatenation: e.g. `Gerobak ST-001` | Required field |
| **Operator** | `operatorName` | `operators` via `shifts` | `shifts.operatorId` → `operators.name` | Operator display name | If no active shift: display assigned operator from `operatorAssignments`, else `"—"` |
| **Mulai** | `startTime` | `shifts` | `shifts.startedAt` | Format `startedAt` to `HH:mm WIB` | If shift not started: `"—"` |
| **Sales** | `shiftSales` | `sales` | `memoryStore.sales` | Sum of `totalMinor` for `shiftId` where `status = 'COMPLETED'` | `Rp 0` |
| **Expenses** | `shiftExpenses`| `expenses` | `memoryStore.expenses` | Sum of `amountMinor` for `shiftId` where `paidFrom = 'CASH_BOX'` | `Rp 0` |
| **Status** | `operationalStatus`| Derived (`Shift` + `Stall`) | `shifts.status`, `stalls.status` | State machine enum: `ACTIVE`, `IDLE`, `CLOSING_SUBMITTED`, `SUSPENDED` | Fallback `IDLE` |

---

## 11. Sales Trend (Chart Contract)

The chart displays hourly gross sales progression for the selected business day:

```ts
export interface SalesTrendPoint {
  readonly bucketHour: number;     // 0..23 (Local hour in Asia/Jakarta)
  readonly bucketLabel: string;    // "00:00", "01:00", ..., "23:00"
  readonly bucketStartUtc: string; // ISO-8601 UTC timestamp
  readonly salesAmountMinor: number;
  readonly transactionCount: number;
}
```

### Bucket & Projection Rules:
- **Bucket Size:** Hourly (60 minutes).
- **Timezone:** Calculated in `Asia/Jakarta` (UTC+7).
- **Zero-Fill:** All 24 hours of the business day must be present in the output array (missing hours filled with `salesAmountMinor: 0` and `transactionCount: 0`).
- **Future Hours:** Hours beyond current local time for today are zero-filled, allowing the chart timeline to preserve consistent 24-hour horizontal axes.
- **Historical Dates:** When viewing a past business day, buckets are computed for all 24 hours of that historical day.

---

## 12. Alerts Catalogue & Classification

| Alert Type | Classification | Trigger Condition | Code / Rule Source |
|---|---|---|---|
| `OUTLET_NOT_STARTED` | **DERIVED RULE** | Current local time > expected start threshold (e.g. 08:00 WIB) AND stall has no shift started today. | Rule derived from `stalls` and `shifts`; opening schedule threshold is currently a configuration gap. |
| `HIGH_EXPENSE_RATIO` | **DERIVED RULE** | Stall expense total / stall sales total > 35% AND stall sales > Rp 100.000. | Financial guardrail derived from `expenses` and `sales`. |
| `LOW_STOCK` | **DERIVED RULE** | Current calculated stock position of any item at stall < threshold (default 10 units). | Sourced from `stockMovements` aggregation (`HQPage` uses `< 10`). |
| `UNRESOLVED_INCIDENT` | **DOMAIN EVENT / ENTITY** | Persisted incident where `incidents.status IN ('OPEN', 'INVESTIGATING')` and `severity = 'CRITICAL'`. | `memoryStore.incidents` (`getIncidentBoardCard`). |
| `UNREPORTED_LOCATION` | **DERIVED RULE** | Shift `status = 'OPEN'` for > 30 minutes with zero active location reports. | Specified in `HQ-DASHBOARD.md` §6; implemented in `getCoverageCard`. |
| `PENDING_VERIFICATION` | **DOMAIN EVENT / ENTITY** | Digital payments where `payments.status = 'PENDING_VERIFICATION'` and age > 1 hour. | Implemented in `getVerificationBacklogCard`. |

---

## 13. Recent Activity

Authoritative activity stream is sourced directly from the append-only audit trail (`audit_events` per ADR-0026):

```ts
export interface DashboardActivityItem {
  readonly id: string;
  readonly occurredAt: string; // ISO UTC
  readonly action: string;     // e.g. "sale.created", "shift.started"
  readonly actorKind: "OPERATOR" | "HQ_USER" | "SYSTEM" | "JOB";
  readonly actorId?: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly summary: string;    // Deterministic projection from action + payload
  readonly stallId?: string;
}
```

### Projection Mapping:
- `shift.started`: "Shift dibuka oleh operator"
- `sale.created`: "Transaksi penjualan selesai"
- `expense.submitted`: "Pengeluaran diajukan"
- `expense.flagged`: "Pengeluaran ditandai untuk review"
- `incident.submitted`: "Insiden operasional dilaporkan"
- `price.acknowledged`: "Perubahan harga disetujui operator"

---

## 14. Scope Model

Every query to the dashboard read model must enforce multi-tenant isolation per ADR-0016 and ADR-0031:

```ts
export interface DashboardQueryScope {
  readonly organizationId: string; // Tenant root (Mandatory)
  readonly businessDay: string;    // YYYY-MM-DD (Mandatory, default today in Asia/Jakarta)
  readonly regionId?: string;      // Optional geographic filter
  readonly areaId?: string;        // Optional supervisor area filter
  readonly stallId?: string;       // Optional single outlet filter
}
```

---

## 15. Blocking Data Gaps

| Gap Identifier | Severity | Description | Resolution Strategy |
|---|---|---|---|
| **GAP-01: No Unified Server Read Model** | `BLOCKING` | Current `src/app/hq/page.tsx` performs 5 uncoordinated client-side `fetch` calls (`/sales`, `/hq/sales`, `/stock`, `/shifts`, `/cash-position`) and stitches data ad-hoc in browser state. | Implement `getHqDashboardSummary` in `src/features/hq/` returning a single typed read model envelope with `computedAt` and freshness band. |
| **GAP-02: Missing Business Day in Expense Query** | `BLOCKING` | `expenses` table lacks a direct `business_day` column; querying today's expenses requires joining `shifts` or translating `incurred_at` via `DEFAULT_BUSINESS_DAY_CONFIG`. | Read-model aggregation must derive business day using `businessDayRange(scope.businessDay)` over `incurredAt` timestamp. |
| **GAP-03: Stall Opening Schedule Undefined** | `NON_BLOCKING` | No table exists for expected stall opening schedules (e.g. 07:00 vs 10:00). Determining "Outlet Terlambat Buka" currently relies on an assumed fixed threshold (e.g., 08:00 WIB). | Define organization-level default opening cutoff in configuration; record gap for per-stall schedule feature. |
| **GAP-04: Digital Revenue Split on Single Card** | `DESIGN_ONLY` | Redesigned KPI card displays one "Penjualan Hari Ini" aggregate, but domain invariant (ADR-0012, FR-PAYMENT-010) forbids merging unverified digital payments into settled cash. | Read model will supply `totalGrossSales`, `cashSalesMinor`, `digitalVerifiedMinor`, and `digitalUnverifiedMinor`. UI renders total with explicit freshness/unverified note. |
| **GAP-05: Hourly Trend Aggregation Missing** | `NON_BLOCKING` | No existing feature module produces 24-hour trend buckets. | Build a deterministic pure projector `aggregateHourlySales(sales, businessDay)` in the HQ feature layer. |

---

## 16. Proposed Read Model Contract

Based strictly on real domain entities and verified UI requirements:

```ts
import type { Money } from "@/shared/money/money";

export interface DashboardKpis {
  readonly salesTotal: Money;
  readonly cashSales: Money;
  readonly digitalVerifiedSales: Money;
  readonly digitalUnverifiedSales: Money;
  readonly transactionCount: number;
  readonly averageTransaction: Money;
  readonly expenseTotal: Money;
  readonly expenseRatioPercentage: number | null;
  readonly activeOutlets: number;
  readonly totalOutlets: number;
}

export interface SalesTrendBucket {
  readonly hour: number;
  readonly label: string;
  readonly salesAmountMinor: number;
  readonly transactionCount: number;
}

export interface OutletTableRow {
  readonly stallId: string;
  readonly stallCode: string;
  readonly stallType: string;
  readonly operatorId?: string;
  readonly operatorName?: string;
  readonly shiftId?: string;
  readonly startedAt?: string;
  readonly salesMinor: number;
  readonly expensesMinor: number;
  readonly status: "ACTIVE" | "IDLE" | "CLOSING_SUBMITTED" | "CLOSED_ACCEPTED" | "SUSPENDED";
}

export interface OperationalAlertItem {
  readonly id: string;
  readonly code: "OUTLET_NOT_STARTED" | "HIGH_EXPENSE_RATIO" | "LOW_STOCK" | "UNRESOLVED_INCIDENT" | "UNREPORTED_LOCATION" | "PENDING_VERIFICATION";
  readonly severity: "INFO" | "ATTENTION" | "CRITICAL";
  readonly title: string;
  readonly message: string;
  readonly entityId?: string;
  readonly occurredAt: string;
}

export interface ActivityFeedItem {
  readonly id: string;
  readonly occurredAt: string;
  readonly action: string;
  readonly description: string;
  readonly actorKind: string;
  readonly actorId?: string;
}

export interface HqDashboardReadModel {
  readonly meta: {
    readonly computedAt: string;
    readonly freshnessBand: "current" | "recent" | "stale";
    readonly organizationId: string;
    readonly businessDay: string;
  };
  readonly kpis: DashboardKpis;
  readonly salesTrend: readonly SalesTrendBucket[];
  readonly outlets: readonly OutletTableRow[];
  readonly alerts: readonly OperationalAlertItem[];
  readonly recentActivity: readonly ActivityFeedItem[];
}
```

---

## 17. Implementation Order

1. **Step 1 (Next Step):** Implement the Server-Side Dashboard Read Model & Query Layer (`src/features/hq/dashboard-read-model.ts`) that executes queries against authoritative domain stores using the contract above.
2. **Step 2:** Create the unified API endpoint (`/api/v1/hq/dashboard`) exposing this read model with caching and ETag headers.
3. **Step 3:** Connect the frontend components in `src/app/hq/page.tsx` to consume the unified read model, eliminating fragmented client-side fetches.
4. **Step 4:** Integrate drill-down modals and links for each card.
5. **Step 5:** Finalize E2E and visual tests, then mark `T-HQ-003` complete.
