# Dashboard data map and T-HQ-003 acceptance checklist

Status: implementation investigation. This document does **not** mark a task complete.

## Canonical T-HQ-003 definition

From `TASKS.md`:

- **Goal:** “The ten cards with exception-first ordering, two-click drill-down, and export.”
- **Behavior:** “cards (Active Operators, Active Selling Points, Today's Gross, Net After Expenses, Digital (verified vs unverified), Cash, Stock Alerts, Unclosed Shifts, Operational Alerts, Location Changes).”
- **Invariants:** “digital verified and unverified never merged; every number drills to records; exports audited.”
- **Failures:** “card error states are explicit and non-misleading.”
- **Tests:** “e2e: card rendering, drill-down, export audit, freshness badges.”
- **DoD:** “HQ can understand the network in a 30-second glance.”

Related canonical rules in `docs/product/HQ-DASHBOARD.md` and `docs/design/PAGES.md`: each card carries `computedAt`/freshness and a refresh affordance; region/area filters are applied server-side; every number drills within viewer scope; exports are audited and carry the export-time freshness.

## Acceptance checklist

| Criterion | Required by the spec? | Evidence / status |
| --- | --- | --- |
| Server-backed read model | Yes; T-HQ-003 depends on T-HQ-002. The HQ product spec says cards are stored read models, not page-side joins. | Existing `src/features/hq/index.ts` has partial raw-store card functions; no unified ten-card model exists yet. |
| Authenticated and scoped access | Yes; `docs/security/PERMISSIONS.md`, API-READ read constraints, and T-HQ-003 security field require it. | `AuthPort` exists but its current provider is fake and returns a default HQ role; it is not production authentication. Must fail closed in production until a real provider is wired. |
| Drill-down | Yes; two-click drill-down, every number resolves to source records. | Existing `drillDown()` is partial, unpaged, and does not cover all cards. |
| Export | Yes; CSV/exports are audited (`export.created`) and scope-filtered. | No HQ dashboard export route exists. |
| Filters | Area/region scope is required and must be server-side. | No unified dashboard filters exist. The requested screen also has outlet and status filters; these should be server-applied for the returned outlet list. |
| Date / date range | A business-day/date context is required for “today” cards. T-HQ-003 does **not** explicitly require arbitrary date ranges. The domain defines a business day in `Asia/Jakarta` with a 04:00 cut. | Implement one validated business-day `date` filter; a multi-day range is not a T-HQ-003 acceptance criterion. |
| Outlet scope | Tenant/area/region scope is mandatory; the UI outlet selector is an additional filter, not an authorization grant. | Outlet selection must be checked against the session-derived scope on every read, drill-down, and export. |
| Pagination | T-HQ-003 itself does not name pagination. `docs/operations/API-READ.md` establishes cursor pagination for mutable/large record lists. | Outlet list and drill-down record lists should use bounded cursor pagination. |
| Persistence | Source operational records must come from persistence; exports and money writes must not be client-only. The read model itself is specified as precomputed/rebuildable in T-HQ-002. | Runtime currently uses `memoryStore`, serialized to local `data/db.json`; Drizzle/Postgres schema is defined but is not the runtime adapter. This is single-process pilot persistence, not a production database. |
| Required test coverage | Yes: e2e cards, drill-down, export audit, freshness; also scope denials. | Existing `tests/e2e/hq-coverage.spec.ts` is illustrative assertions only and does not visit the app. |

## Authoritative source map

The runtime source is `src/server/db/memory-store.ts`; its interfaces mirror `src/server/db/schema.ts`. The product uses **selling locations** as the dashboard's outlet-like selling points. A `stall` is the cart/equipment; a `shift` binds an operator and stall to a business day; `locationReports` preserve which selling point was used during a shift.

| Dashboard field | Authoritative entity / fields | Query and calculation | Limits / caveats |
| --- | --- | --- | --- |
| Registered outlet name/status | `sellingLocations`: `id`, `organizationId`, `areaId`, `name`, `status` | List only locations visible within session scope; optional `sellingLocationId`, search, and status filters. | “Outlet” is presentation wording; domain entity is `SellingLocation`. |
| Operator / start / operational status | `shifts`: `operatorId`, `stallId`, `businessDay`, `startedAt`, `status`, `startLocationId`; `operators`; `stalls`; `locationReports` | Resolve today's shifts, then resolve the shift's selling location from reports (or `startLocationId` when no report exists); only OPEN/PENDING_SYNC count as operating. | No planned-shift entity exists in the runtime store, so “not started” means an eligible registered location has no current-day active shift; it cannot assert an assigned operator failed to start. |
| Sales / transaction count | `sales`: `organizationId`, `businessDay`, `sellingLocationId`, `occurredAt`, `totalMinor`, `status`; `saleItems`; `payments` | Sum/count only COMPLETED sales for the business day. Group by `sellingLocationId`; join payment states for the verified/unverified split. | Do not count DRAFT sales as completed revenue. All arithmetic remains integer IDR. |
| Average transaction | Same completed `sales` query | `round(totalMinor / completedSaleCount)`; zero when count is zero. | Presentation formats integer IDR. |
| Verified / unverified digital and cash | `payments`: `method`, `status`, `amountMinor`, `saleId` | Aggregate by payment method and state; never merge PENDING/PENDING_VERIFICATION into verified revenue. | Provider references remain masked except for allowed finance/auditor roles. |
| Expenses / expense ratio | `expenses`: `shiftId`, optional `sellingLocationId`, `amountMinor`, `incurredAt`, `reviewStatus`, `flaggedReason`, `paidFrom`; `shifts` | Join expense to its shift's business day; group by explicit expense location or the shift's start location. Sum amount and compute ratio only when sales > 0. | Runtime expense rows may omit `sellingLocationId`; fallback is the shift's start location, not a guessed location history. |
| Outlet activity table | Join `sellingLocations`, `shifts`, `operators`, completed `sales`, `expenses` | One row per visible selling location; current-day shift/operator and start time; sums by source records; server cursor pagination. | Empty operator/time is rendered as unavailable, never filled from demo values. |
| Sales trend | `sales.occurredAt`, `businessDay`, `sellingLocationId`, `totalMinor`, `status` | Aggregate completed sales into Jakarta-time buckets for the selected business day; optional chart-period aggregation must remain server-derived. | No synthetic progression when the day has no sales. |
| Alerts | `alerts`, open `incidents`, flagged `expenses`, active `shifts` + `locationReports` | Read persisted alerts and derive only conditions with a documented rule (e.g. active shift without a location report after the documented 30-minute threshold). | No stock-low alert is derived until an authoritative reorder threshold exists; `getStockPositionCard()` currently returns constant zeros. |
| Recent activity | Append-only `auditEvents` plus referenced source entities | Sort by event time; map supported actions to Indonesian labels and join to a scoped outlet/operator. | Do not invent “recent” events. Unknown event types are omitted. |
| Outlet detail | Same selling-location/shift/sale/expense/incident/activity sources | Re-query by outlet ID under the current session's scope, then paginate source records. | Rechecking scope is mandatory; do not trust the dashboard link or selected outlet ID. |
| Export | Same server read model and active date/outlet/area filters | Generate CSV server-side, include generatedAt/source watermark, then append `export.created` audit event. | No client-generated CSV from only the visible table. |

## Authorization and mutation boundary

`docs/security/PERMISSIONS.md` grants HQ operations read/management capabilities but does **not** grant HQ operations `sale:create`, `payment:cash`, or `expense:submit`. Operator actions are self-scoped; supervisor expense submission is self-scoped. The visual design's HQ “Catat Transaksi”/“Catat Pengeluaran” buttons therefore conflict with the current permission matrix. Do not elevate a role, attribute a sale to an operator without their action, or write around the existing commands to make those buttons appear successful. Until product/security policy resolves this conflict, the dashboard must respect server denial and the money mutations remain an explicit integration blocker.

The runtime session provider also remains a fake development provider; it is not real user authentication. Production requests must fail closed until a real implementation of the existing `AuthPort` is provided. `memoryStore` is a local JSON-persisted pilot adapter, not PostgreSQL; the Drizzle schema is design-time only.

## Task status

This work is related to T-HQ-002/T-HQ-003 but does not change their status. T-HQ-003 remains **NOT DONE** until the ten specified cards, stale/error states, scoped drill-downs, audited export, freshness and e2e/security criteria are all demonstrated against the authoritative persistence and auth implementations.
