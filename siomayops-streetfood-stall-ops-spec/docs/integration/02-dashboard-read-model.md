# Dashboard Read Model

**Document ID:** DOC-INTEGRATION-02
**Status:** implemented read layer (server-side only). No API route, UI, drill-down, export or
mutation consumes it yet; T-HQ-003 remains open.
**Related:** `docs/product/HQ-DASHBOARD.md`, `docs/operations/API-READ.md`, `HQ.md`, `SALES.md`,
`EXPENSES.md`, `TASKS.md` (T-HQ-002), `docs/security/PERMISSIONS.md`,
`docs/adr/ADR-0033-time-and-business-day.md`, `docs/finance/EXPENSE-REVIEW.md`

---

## Implementation Location

| Piece | File |
| --- | --- |
| Read model types + query | `src/features/hq/dashboard.ts` (`getHqDashboard`, `getHqDashboardForSession`) |
| Scope-mandatory read access | `src/server/db/repository.ts` (`openScopedReader`) |
| Module re-export | `src/features/hq/index.ts` |
| Tests | `tests/integration/hq-dashboard-read-model.test.ts` |

```text
persisted records (file-backed store: src/server/db/memory-store.ts -> data/db.json)
  -> openScopedReader(scope)      scope-mandatory reads, one bounded pass per collection
    -> getHqDashboard()           KPI / trend / stall / alert / activity aggregation
      -> HqDashboardReadModel     data only: integer minor units, ISO-8601 instants, type codes
```

No file under `src/app/**` was changed; nothing fetches or renders this model yet.

## Input Contract

```ts
getHqDashboardForSession({ session: SessionContext, businessDay: string, stallId?: string,
                           activityLimit?: number, clock?: Clock })

getHqDashboard({ scope: AuthorizedHqScope, businessDay: string, stallId?: string,
                 activityLimit?: number, clock?: Clock })
```

| Input | Rule |
| --- | --- |
| `session` / `scope` | The only source of scope. `getHqDashboardForSession` calls the existing `authorize(session, "hq:view", session.scope)`. `AuthorizedHqScope` is a branded type that only `authorizeHqScope()` produces, so a hand-written scope object does not compile. |
| `businessDay` | `YYYY-MM-DD`, must be a real calendar date; otherwise `VALIDATION_FAILED`. Never taken from a device (ADR-0033). |
| `stallId` | Optional outlet filter (the domain entity is a **stall**, not an "outlet"). Empty string -> `VALIDATION_FAILED`; unknown inside the organization -> `NOT_FOUND`; existing but outside the authorized scope -> `FORBIDDEN`. A stall of another organization is `NOT_FOUND`, so cross-tenant existence is never revealed. |
| `activityLimit` | Integer 1..200 (default 25, the API-READ pagination default). Out of range -> `VALIDATION_FAILED`, never silently clamped. |
| `clock` | Injected `Clock` from `src/shared/time`; defaults to `systemClock`. |

Errors are `HqDashboardError` with `code` in `VALIDATION_FAILED | NOT_FOUND | FORBIDDEN` (the
canonical envelope codes). Unsupported scopes (`region`, `self`, missing `areaId`/`stallId`) are
denied by `openScopedReader` — a missing or ambiguous scope never widens the read.

## Output Contract

`HqDashboardReadModel` fields (all money is integer minor units, currency `IDR`; all instants are
ISO-8601 UTC strings; no locale formatting, no rendered text):

| Field | Meaning |
| --- | --- |
| `generatedAt`, `freshnessBand` | When the model was produced and the freshness band (`current` < 5 min, `recent` 5–60 min, `stale` > 60 min). Freshly computed models are `current`; the field exists so a future stored model cannot hide staleness (FR-HQ-008). |
| `businessDay`, `currency`, `filters` | Echo of the applied day, currency and `{ businessDay, scopeKind, stallId? }`. |
| `kpis` | `salesMinor`, `transactionCount`, `averageTransactionMinor`, `expensesMinor`, `expenseRatio`, `activeStalls`, `totalStalls`. |
| `salesTrend` | 24 hourly buckets from the business-day start, zero-filled, chronological, each `{ bucketStart, amountMinor, transactionCount }`. |
| `stalls` | One summary per authorized stall: `stallId`, `code`, `areaId`, `registryStatus`, `operationalStatus`, `activeShiftId`, `activeShiftStatus`, `operatorId`, `operatorName`, `startedAt`, `salesMinor`, `transactionCount`, `expensesMinor`. Ordered by `code`, never by sales. |
| `alerts` | Structured `OperationalAlert`: `alertId`, `type`, `severity`, `stallId?`, `shiftId?`, `entityType?`, `entityId?`, `createdAt`, `metadata?`. No alert message text. |
| `recentActivity` | `activityId`, `occurredAt`, `type` (audit action), `actorId`, `actorKind`, `actorRole`, `entityType`, `entityId`, `stallId?`, `reason?`. Newest first. |

## Source Repositories

`openScopedReader(scope)` (in `src/server/db/repository.ts`) is the single read path; it resolves the
scope once (organization, then area/stall narrowing) and exposes:

| Method | Scope applied |
| --- | --- |
| `listAuthorizedStalls()` | organization + area/stall narrowing |
| `findStallInOrganization(stallId)` | organization only (used to distinguish `NOT_FOUND` from `FORBIDDEN`) |
| `listOperators(operatorIds?)` | organization + the operator ids of in-scope shifts |
| `listShifts({ businessDay })` | organization + day + stall narrowing |
| `listSales({ businessDay })` | organization + day + stall narrowing (business status filter stays in the query) |
| `listExpenses({ shiftIds })` | organization + shifts of the selected day (hence in-scope) |
| `listPayments({ saleIds })` | organization + sales of the selected day |
| `listLocationReports({ shiftIds })` | organization + shifts of the selected day |
| `listAlerts()` | organization; area/stall attribution happens in the query, fail closed |
| `listAuditEvents({ from, to })` | organization + business-day range; attribution narrowing in the query |

## KPI Rules

| KPI | Rule |
| --- | --- |
| `salesMinor` | Sum of `totalMinor` for sales with `status = COMPLETED` on the selected business day, inside scope. `DRAFT`, `VOIDED` and `CORRECTED` records are excluded; a void keeps its original record (`SALES.md` §2: only COMPLETED counts toward shift totals). |
| `transactionCount` | Count of those COMPLETED sales. |
| `averageTransactionMinor` | `Math.round(salesMinor / transactionCount)` in integer minor units; `0` when there are no transactions (no division by zero, no fabricated average). |
| `expensesMinor` | Sum of `amountMinor` of every expense whose shift belongs to the selected business day, inside scope. An expense is attributed to the day through its shift's server-derived `businessDay`; `incurredAt` (device time) is never used. Shifts outside the day, and orphan expenses whose shift is missing, are excluded. |
| `expenseRatio` | `expensesMinor / salesMinor`, `null` when `salesMinor = 0`. Dimensionless; never used for money arithmetic. |
| `activeStalls` | Stalls in scope with a shift in `OPEN`, `PENDING_SYNC` or `SUSPENDED` on the selected day (the `listActiveShifts` rule; SUSPENDED can only return to OPEN, be closed or be voided). Status is never inferred from sales recency. |
| `totalStalls` | Stalls in the authorized scope for the selected day, after the optional stall filter. |

All totals pass through the `money()` integer validator before being returned, so a
floating-point or unsafe value fails loudly instead of shipping.

## Scope Enforcement

- The query never accepts an organization id, area id or stall list. It accepts a session-derived
  authorization scope only; `openScopedReader` denies `region` (no persisted region data), `self`
  (no attribution rule) and incomplete area/stall scopes.
- Organization filtering happens inside every reader method; area/stall narrowing is applied to
  shifts and sales by stall id, and to expenses/payments/location reports through the shift/sale
  ids that already passed the narrowing.
- Alerts and audit activity that cannot be attributed to an authorized stall are excluded for
  non-organization scopes (fail closed).
- Enforcement is server-side; there is no client filtering path and no unscoped reader method.
- Warning: the existing legacy card helper `getCoverageCard` counts `OPEN`/`PENDING_SYNC` only,
  while this model treats `SUSPENDED` as active (matching `listActiveShifts`). Reconciling the two
  is tracked as a gap below.

## Date / Time Handling

- Business day = Asia/Jakarta (UTC+7, no DST), cut hour 04:00 (`DEFAULT_BUSINESS_DAY_CONFIG`).
- `businessDayRange(day, config)` returns a half-open window `{ start, end }`: start = 04:00 local
  on the day, end = 04:00 local on the next day; `end` is exclusive. Timestamps are compared as
  `t >= start && t < end`; no string `startsWith` prefix matching anywhere.
- Sales are attributed to the business day by their stored `businessDay` (server-derived) and placed
  in the trend by `serverAcceptedAt` (falling back to `createdAt`); device `occurredAt` is metadata,
  never a bucket input (ADR-0033).
- A sale the server attributed to the day but accepted outside the window (for example a shift that
  ran past the 04:00 cut-off) is clamped to the first/last bucket so `sum(salesTrend) = kpis.sales`.
  Unplaceable timestamps (non-finite dates) are excluded from the trend only.
- Expenses are attributed to the day through their shift, never through `incurredAt`.
- The server timezone is never used; all stored instants are UTC and only the cut rule is local.

## Alert Rules

Only deterministic, already-documented rules are implemented. Severity mapping from the catalogue
(`docs/product/HQ-DASHBOARD.md` §6): ATTENTION -> `warning`, INFO -> `info`, SECURITY/BLOCKING ->
`critical`; stored severity `INFO`/`WARNING`/`CRITICAL` maps to `info`/`warning`/`critical`.

| Alert | Source | Trigger | Severity |
| --- | --- | --- | --- |
| Persisted alert (type as recorded, for example `RESTOCK_REQUEST`, `QUARANTINE`, notification template ids) | `memoryStore.alerts` | `acknowledged = false`, inside scope, current condition (not day-filtered) | from the stored severity |
| `shift_without_location_report` | shifts + location reports | Active session (`OPEN`/`PENDING_SYNC`/`SUSPENDED`) open more than 30 minutes with no current location report (`departedAt` unset) | `warning` (catalogue: ATTENTION) |
| `expense_review_required` | expenses | Expense of the selected day with `reviewStatus` `REVIEW_REQUIRED` or `ESCALATED`; `metadata` carries `category`, `amountMinor`, `paidFrom`, `reviewStatus`, `flaggedReason` (rule id only) | `info` (catalogue: "Expense pattern flagged") |

Derived ids are deterministic (`<type>:<entityId>`), so repeated reads cannot duplicate alerts.
Alerts are sorted by severity, then `createdAt` descending, then `alertId`, and capped at
`DASHBOARD_ALERT_LIMIT = 50`. Alert text (`message`) is deliberately not returned: presentation
belongs to the delivery layer.

## Activity Projection

- Source: the append-only audit stream (`memoryStore.auditEvents`) — the persisted domain activity
  already written by features (shift, sale, payment, expense, price, incident, loyalty, authz, …).
- Window: audit events with `occurredAt` in the selected business-day range, organization-scoped.
- Attribution: an event is attributed to a stall through an index built once per read from the
  day's shifts, sales, expenses, payments and location reports (`shift:*`, `sale:*`, `expense:*`,
  `payment:*`, `location_report:*`); `stall:*` events resolve directly. Events without a resolvable
  stall are included for organization scope and excluded for area/stall scope (fail closed).
- Ordering and size: `occurredAt` descending, ties broken by event id ascending; sliced to
  `activityLimit` (default 25, max 200) after the scope filter, so the limit is never consumed by
  out-of-scope rows.

## Performance Characteristics

- One bounded pass per collection per read (stalls, operators, shifts, sales, expenses, payments,
  location reports, alerts, audit events). No per-row reads: aggregation uses maps keyed by
  stall/shift/sale id built during those passes.
- Date arithmetic is computed once per call (`businessDayRange`, one bucket size).
- Authorization is resolved once per call, not per record.
- The audit scan is linear in the whole audit array, and alerts are scanned organization-wide; this
  is acceptable at pilot scale but is the first thing a Postgres/Drizzle implementation must index
  (`organization_id, occurred_at` and `organization_id, acknowledged`).
- No caching/Redis is introduced; the model is recomputed per call and labelled with `generatedAt`.

## Known Gaps

1. **Promised inputs are absent.** The task brief referenced two earlier integration documents
   (docs/integration/00-dashboard-ground-truth and docs/integration/01-dashboard-data-map); neither
   exists in the repository and neither is in git history. Every rule above is derived from the
   in-repo product documents named in **Related**.
2. **Not delivered by this step (by design):** API wiring, dashboard UI, drill-down endpoints,
   exports, mutations and role-based field masking. T-HQ-003 is not closed.
3. **Persisted alerts have no structured payload.** Current call sites store a free-text `message`
   plus `type`/`severity`/entity pointers, so the read model exposes type/severity/entity only. The
   delivery layer can map a type to wording, but alert types that need structured detail (for
   example restock line items) will need structured metadata at write time.
4. **Threshold-driven alerts are not implemented:** cash variance beyond tolerance, stock variance
   beyond threshold, "unverified digital payment old" (verification SLA is open as HQ-OQ-1),
   closing missing after the 21:00 cut-off, shift longer than maximum. Their thresholds are not yet
   a server-side source of truth (`src/app/api/v1/config/thresholds/route.ts` is a hard-coded
   response), and inventing them was explicitly out of scope.
5. **Expense alerts are day-scoped.** The review queue itself is a cross-day, current-state queue;
   this model only raises expense alerts for the shifts of the selected business day.
6. **Pending-verification payments are not projected at all** (a card-level concern that needs the
   verification SLA), and there is no verified/unverified digital split in this model yet.
7. **Unattributed records.** Organization-wide totals include records whose stall is missing from
   the stall registry; such records cannot appear in a `stalls[]` row, and narrower (area/stall)
   scopes exclude them entirely.
8. **Expense status is not filtered.** `REJECTED` expenses remain in the day's expense total because
   no rule documents their exclusion from the cost line; only review-required ones raise alerts.
9. **Scope kinds `region` and `self` are denied** (no persisted region field, no self-attribution
   rule). A regional dashboard would need a data-model change.
10. **Alert cap.** Alerts are truncated at 50 after severity ordering; there is no cursor pagination
    for alerts yet.
11. **Single storage adapter.** The reader is backed by the file-backed in-memory store (no real
    transactions or indexes). A Postgres/Drizzle implementation must keep the same scope semantics.
12. **Legacy inconsistency.** `getCoverageCard` in `src/features/hq/index.ts` excludes `SUSPENDED`
    shifts from "active", while this model includes them; the legacy card was left untouched.
13. **Traceability partial.** `docs/TRACEABILITY.md` notes the new test for the HQ feature row;
    `TASKS.md`, `IMPLEMENTATION_STATUS.md` and the API contract were intentionally not modified.
