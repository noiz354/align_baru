# Dashboard Read Model

**Document ID:** DOC-INTEGRATION-02
**Status:** the dashboard is delivered and wired. Two read models currently coexist on `main`
(the older `features/hq/dashboard.ts` behind `/` and the HTTP readers, and the newer
`features/hq/dashboard-read-model.ts` behind the `/hq` boundary — see
`docs/integration/05-hq-dashboard-ui-integration.md`); this document records the contracts, the
scope hardening applied to **both** server paths, and the remaining conformance gaps against
`docs/integration/01-dashboard-data-map.md`.
**Related:** `docs/integration/00-dashboard-ground-truth.md`, `docs/integration/01-dashboard-data-map.md`,
`docs/product/HQ-DASHBOARD.md`, `docs/operations/API-READ.md`, `HQ.md`, `SALES.md`, `EXPENSES.md`,
`docs/adr/ADR-0033-time-and-business-day.md`, `docs/security/PERMISSIONS.md`

---

## Implementation Location

| Piece | File |
| --- | --- |
| Older read model + query (`getHqDashboard`, `getHqOutletDetail`, `authorizeHqScope`) | `src/features/hq/dashboard.ts` |
| Newer read model behind the `/hq` boundary (`getHqDashboardReadModel`, `isAuthorizedOutlet`) | `src/features/hq/dashboard-read-model.ts` |
| Authenticated server boundary (`loadHqDashboard`) | `src/server/dashboard/boundary.ts` |
| Scope-mandatory reader used for fail-closed scope resolution on both paths | `src/server/db/repository.ts` (`openScopedReader`) |
| Delivery: dashboard JSON | `src/app/api/v1/hq/dashboard/route.ts` (via the boundary) |
| Delivery: CSV export (audited) | `src/app/api/v1/hq/dashboard/export/route.ts` |
| Delivery: outlet drill-down | `src/app/api/v1/hq/outlets/[outletId]/route.ts`, `src/app/hq/outlets/[outletId]/page.tsx` |
| Tests | `tests/unit/hq-dashboard.test.ts`, `tests/integration/hq-dashboard-scope-isolation.test.ts`, `tests/integration/hq-dashboard-boundary.test.ts` |

```text
persisted records (file-backed store: src/server/db/memory-store.ts -> data/db.json)
  → getHqDashboard()            scoped aggregation of the selected business day
    → HqDashboardReadModel      single response: kpis · salesTrend · outlets · alerts · activity
      → /api/v1/hq/dashboard (+ /export, /outlets/{id})  → UI
```

Nothing is aggregated inline on the page: the browser receives one model and renders it.

## Input Contract

```ts
authorizeHqScope(session: SessionContext): AuthorizedHqScope

getHqDashboard({ scope: AuthorizedHqScope, businessDay, outletId?, areaId?,
                 search?, status?, cursor?, limit? }): HqDashboardReadModel
getHqOutletDetail({ scope: AuthorizedHqScope, businessDay, outletId, cursor?, limit? }): HqOutletDetail
```

| Input | Rule |
| --- | --- |
| `session` | The only source of scope. All three delivery routes call `authorizeHqScope(session)`; no route accepts a scope, organization, area or outlet list from the request body. |
| `scope` | `AuthorizedHqScope` is a branded type that only `authorizeHqScope()` produces, so a hand-written scope object does not compile. |
| `businessDay` | `YYYY-MM-DD`; routes validate the shape and that the date is real. The default day is server-derived (`getDefaultDashboardDay()`), never taken from the device. |
| `outletId`, `areaId`, `status`, `search`, `cursor`, `limit` | Filters applied after scope resolution. `limit` is validated 1..100 by the routes. |
| Errors | `HqDashboardNotFoundError` (`code = "NOT_FOUND"`) for an unknown or out-of-scope outlet or area; `FORBIDDEN` for a role without `hq:view` / `hq:export` or for an unresolvable scope. |

## Output Contract

`HqDashboardReadModel` (money is integer minor units, `IDR`; instants are ISO-8601 UTC strings):

| Field | Meaning |
| --- | --- |
| `generatedAt`, `sourceWatermark` | When the model was produced and the newest source record timestamp it included (FR-HQ-008 freshness). |
| `scope` | `{ businessDay, outletId }` echo of the applied filters. |
| `kpis` | `salesMinor`, `previousDaySalesMinor`, `salesChangeBps`, `transactionCount`, `averageTransactionMinor`, `cashSalesMinor`, `digitalVerifiedMinor`, `digitalUnverifiedMinor`, `expensesMinor`, `expenseRatioBps`, `activeOutlets`, `totalOutlets`, `notStartedOutlets`. Verified and unverified digital amounts are separate fields and are never summed (FR-PAYMENT-010). |
| `salesTrend` | Cumulative checkpoints at 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00 (`{ label, cumulativeMinor }`). |
| `outlets` / `outletOptions` / `pagination` | Paged outlet rows (`id`, `name`, `areaId`, `operatorName`, `operatorId`, `activeShiftId`, `startedAt`, `salesMinor`, `transactionCount`, `expensesMinor`, `status`, `statusReason`), the full scoped option list, and `{ limit, nextCursor, total }`. |
| `alerts` | `{ id, outletId, outletName, kind, severity, title, description, createdAt, href }` with `kind ∈ SHIFT_LOCATION_MISSING · FLAGGED_EXPENSE · INCIDENT · RECORDED_ALERT`. |
| `activity` | `{ id, occurredAt, outletId, outletName, kind, description, amountMinor, secondary }`, newest first. |

Presentation: the model still carries localized `title`/`description`/`statusReason` strings for the
current UI. They are derived from records (never from a stored judgement), and the structured fields
(`kind`, `severity`, `status`, ids, `href`) are always present, so a stricter presentation layer can
be built without changing the query.

## Source Repositories

Reads go directly through `memoryStore` inside the read model; `openScopedReader(scope)` is used by
`authorizeHqScope()` to prove the scope is resolvable before any aggregation. Every store access is
organization-filtered (`scope.organizationId`), then narrowed:

| Collection | Narrowing beyond organization |
| --- | --- |
| `sellingLocations` | `canSeeLocation` (area match, or stall/self membership through shifts) |
| `shifts` | day + area/stall/self, and the outlet must be in the visible location set |
| `sales` | day + `sellingLocationId ∈ visible` + optional selected outlet |
| `payments` | only payments of the sales already in scope |
| `expenses` | organization + the shift's business day + the expense's outlet in the visible set |
| `incidents`, `alerts` | organization, then outlet attribution; unattributed rows are dropped for non-org scopes |
| `auditEvents` | organization, then attribution to a visible outlet for activity rows |

## KPI Rules

| KPI | Rule |
| --- | --- |
| `salesMinor` | Sum of `totalMinor` for `status = COMPLETED` sales of the day, in scope (map §3.1). |
| `transactionCount` | Count of those sales (map §3.2). |
| `averageTransactionMinor` | `Math.round(sales / count)`, `0` when the count is zero (map §3.3). |
| `expensesMinor` | Sum of `amountMinor` of the day's shifts' expenses, in scope, **excluding `reviewStatus = 'REJECTED'`** (map §3.4, implemented in this change). |
| `expenseRatioBps` | `Math.round((expenses / sales) * 10000)` when sales exist, else `0`. See gap G1. |
| `cashSalesMinor` / `digitalVerifiedMinor` / `digitalUnverifiedMinor` | Payment totals split by method and verification status; never merged. |
| `previousDaySalesMinor`, `salesChangeBps` | Previous business day's completed sales and the change in basis points (`null` when the previous day is 0). |
| `activeOutlets` | Distinct outlets with a shift in `OPEN`/`PENDING_SYNC` on the day. |
| `totalOutlets` | Visible outlets (locations) for the day, after the area/outlet filter. |
| `notStartedOutlets` | Visible outlets that are not closed and have no active shift. |

## Scope Enforcement

- Both server paths fail closed on scope:
  1. **Boundary path (`/hq`, `GET /api/v1/hq/dashboard`)** — `loadHqDashboard()` runs the existing
     `authorize(session, "hq:view", org)` check, then resolves the scope through
     `openScopedReader`; `region` and incomplete `area`/`stall` scopes return `FORBIDDEN` instead of
     falling back to an organization-wide read. A store that cannot answer stays a separate
     `UNAVAILABLE` failure (the two are told apart by the error code, never conflated).
  2. **Older path (`/`, export, outlet drill-down)** — `authorizeHqScope(session)` additionally
     requires that the session scope belongs to the session organization, then applies the same
     role check and resolution check, returning a branded `AuthorizedHqScope`.
- Every collection is filtered by organization first, then by area/stall membership, so a session in
  organization A cannot see organization B's outlets, sales, expenses, alerts or activity — in the
  dashboard, the CSV export, or the outlet drill-down.
- A requested outlet/area outside the scope raises `NOT_FOUND`; another tenant's identifier is
  indistinguishable from a nonexistent one, so existence is not revealed.
- `tests/integration/hq-dashboard-scope-isolation.test.ts` asserts this in both directions for the
  older model (plus drill-down and the fail-closed scope checks);
  `tests/integration/hq-dashboard-boundary.test.ts` asserts the same for the boundary path, and the
  boundary suite already proves cross-organization rows never reach the model.

## Date / Time Handling

- Business day = Asia/Jakarta (UTC+7, no DST), cut hour 04:00 (`DEFAULT_BUSINESS_DAY_CONFIG`,
  ADR-0033). The day is always server-derived.
- Sales carry their stored server-derived `businessDay`; the previous-day comparison uses the same
  derivation (`previousBusinessDay`), and `rangeContains` compares business days, never string
  prefixes.
- Expenses are attributed to the day through their shift's `businessDay` (map §3.4 / GAP-02),
  never through `incurredAt`.
- Trend labels are Jakarta hours; the response never formats a timezone the server is not in.

## Alert Rules

| Alert | Trigger | Severity |
| --- | --- | --- |
| `SHIFT_LOCATION_MISSING` | Active shift open > 30 minutes with no current location report (`docs/product/HQ-DASHBOARD.md` §6, the only documented threshold) | `WARNING` |
| `FLAGGED_EXPENSE` | Expense carrying a `flaggedReason` on an active shift | `WARNING` |
| `INCIDENT` | Incident not `RESOLVED`/`CLOSED` (map §2 "Unresolved Incident") | `WARNING` |
| `RECORDED_ALERT` | Persisted unacknowledged alert | stored severity |

Alerts carry a `href` to the record or the outlet drill-down. Threshold-driven rules whose
threshold has no configured source (high expense ratio, low stock, outlet not started) are
deliberately **not** implemented (map GAP-03 and §15).

## Activity Projection

- Source: the append-only audit stream, restricted to the selected business day and the scope.
- Each row is mapped to a UI `kind` (`SALE`/`EXPENSE`/`SHIFT`/`PRODUCT`/`OTHER`), resolved to a
  visible outlet, and sorted by `occurredAt` descending. Rows that cannot be attributed to a visible
  outlet are dropped for non-org scopes.
- The feed stops at 8 entries (current UI need). The map specifies a limit of 20 (gap G3).

## Performance Characteristics

- The model is computed synchronously per request; no Redis or cache layer is added.
- Each request performs a bounded set of full collection scans, and the pagination is applied after
  scoping (never before), so filters cannot expose rows.
- Two known inefficiencies inherited from the delivered implementation: outlet rows re-scan
  `memoryStore.expenses` per row, and the outlet detail resolves payments per transaction. Both are
  acceptable at pilot scale and are the first candidates for indexing/joins in a Postgres port.
- Authorization and scope resolution happen once per request, not per record.

## Known Gaps

1. **G1 — `expenseRatioBps` uses `0` when sales are 0.** The map (§3.5) allows `null` / "N/A" to
   avoid a value that reads as a real 0%. Changing it means changing the UI contract, so it is left
   for the UI owner; a zero-sales day is currently indistinguishable from a genuine 0% ratio.
2. **G2 — Outlet-row expenses are not cash-box only.** Map §2 specifies `paidFrom = 'CASH_BOX'` for
   the outlet table's expense column; the delivered model sums all non-rejected expenses. Only the
   `REJECTED` rule (map §3.4) is implemented in this change.
3. **G3 — Trend buckets differ from the map.** The map asks for 24 hourly buckets 00–23; the
   delivered model returns 7 cumulative checkpoints (06:00–18:00) as `cumulativeMinor`.
4. **G4 — Activity limit is 8, the map specifies 20**, and the limit is not a parameter.
5. **G5 — No pending-digital-verification alert.** The map's §1.4 queue is derivable
   (`payments.status = 'PENDING_VERIFICATION'`), but the verification SLA is still open (HQ-OQ-1), so
   no threshold is invented; the amounts are exposed in the KPIs only.
6. **G6 — Threshold alerts and their configuration.** High expense ratio, low stock and "outlet not
   started" need thresholds that are not yet a server-side source of truth
   (`src/app/api/v1/config/thresholds/route.ts` is a hard-coded response), so they are not
   implemented (map GAP-03, §15).
7. **G7 — `T-HQ-002` stored read models are still absent.** The model is computed on demand; there
   is no scheduled rebuild, no persisted per-area/day row and no `computedAt`-based staleness band
   (the route reports `freshnessBand: "current"`, which is accurate only because the model is
   recomputed on every request). `sourceWatermark` is present and populated.
8. **G8 — `region` and `self` scopes are not supported for the dashboard** (no persisted region
   data; operators have no HQ read capability). Both are denied explicitly rather than widened.
9. **G9 — Presentation strings live in the model** (`title`, `description`, `statusReason`). They are
   derived from records, but a localization/strict-rendering layer would prefer codes only.
10. **G10 — Field masking is not applied.** Operator names appear whenever a shift is active
    (`HQ.md` §8 forbids surveillance tiles, not operator names, but role-based masking per
    `docs/security/PERMISSIONS.md` §4 is still unimplemented).
11. **G11 — Two read models coexist.** `/` and the HTTP readers use `features/hq/dashboard.ts`;
    `/hq` uses `features/hq/dashboard-read-model.ts` through the boundary. They define different
    contracts (the older one treats an outlet as a selling location, the newer one as a stall), so
    consolidating them is still open work; this document covers both paths' scope behaviour only.
