# Page 08 — Reports & Export ground-truth audit

**Date:** 2026-09-30 (Asia/Jakarta)
**Canonical prompt:** `docs/product/end-to-end-pages/08-reports-export.md`
**Route:** `/reports`
**Audit phase:** completed before page-08 implementation; no page-08 code changes were made when this baseline was recorded.
**Sequence note:** work proceeds to page 08 at the user's direction; page 07 browser acceptance is still outstanding and is not being marked complete.

## Existing behavior found

| Capability | Status | Evidence / notes |
|---|---|---|
| `/reports` user interface | `MISSING` | No `src/app/reports` route exists. The `/hq` page is a separate, incomplete dashboard surface and is not a reports page. |
| Sales by business day/outlet | `PARTIAL` | `getHqDashboard` in `src/features/hq/dashboard.ts` derives completed-sale totals, transaction counts, mean transaction value, payment-method totals, and outlet summaries for a single business day. The dashboard API exposes it at `GET /api/v1/hq/dashboard`; no dedicated report page or multi-day report endpoint exists. |
| Expense report | `PARTIAL` | The dashboard model joins stored expenses to their shift business day and location to calculate daily/outlet totals. `GET /api/v1/expenses` is an operational list with its own scope and filters, not a cross-outlet/date-range report contract. |
| Outlet performance | `PARTIAL` | The dashboard read model returns daily outlet summaries and cursor pagination, under its scope. It is a single-day dashboard table, not a dedicated report with a date range or export selection. |
| Time series | `PARTIAL` | `getHqDashboard` returns a same-day cumulative sales trend in fixed Jakarta-time buckets. It does not return a multi-day sales/expense/incident series. |
| Incident counts | `PARTIAL` | `GET /api/v1/hq/incidents` returns organization-wide all-time totals by category and status. It has no date/outlet filters; the persisted incident shape has category/status/createdAt and optional shift but no severity field. Dashboard alerts include open incidents but are not a count report. |
| Existing on-demand CSV | `PARTIAL` | `GET /api/v1/hq/dashboard/export` builds a CSV from the dashboard service, applies session scope and supplied day/area/outlet/status/search filters, neutralizes spreadsheet formula prefixes, returns no-store attachment headers, and writes `export.created` audit. It exports dashboard outlet rows only, not the requested complete sales/expense/time-series/incident report. It supplies `limit: 10_000` but does not follow a cursor or warn if outlet rows exceed that amount. |
| Export jobs or saved reports | `UNSUPPORTED` | Export is an immediate response; no job, stored export artifact, scheduled delivery, or saved-report entity exists. |
| Authorization and tenant scope | `PARTIAL` | Dashboard GET/export resolve session and call `authorize`; the dashboard read model derives visible outlets from `session.scope` and rejects hidden outlet IDs. Production auth remains unsupported: the existing development provider is fake and returns no session in production. Other legacy HQ rollup routes (for example `/api/v1/hq/sales` and `/api/v1/hq/incidents`) are organization-level reads and are not a suitable substitute for a newly scoped report contract. |
| Persistence | `IMPLEMENTED` (pilot adapter only) | Operational source records are held in `memoryStore` and serialized to `data/db.json`; PostgreSQL schema is not the active runtime. Reports must query these persisted facts and must not introduce mock values. |
| Report-specific analytics | `MISSING` | No `report_viewed`, `report_filter_changed`, or report-export analytics family was found. Existing export has an audit event but no page-specific analytics. |
| Tests | `PARTIAL` | `tests/unit/hq-dashboard.test.ts` covers current single-day aggregate/scope behavior. `tests/e2e/hq-coverage.spec.ts` uses local synthetic objects and does not visit the application. No dedicated `/reports`, report-range, export CSV, or export-audit boundary test was found. |

## Existing source and presentation map

| Report field/action | Existing domain/read source | Persistence source | Existing server entrypoint | Baseline status |
|---|---|---|---|---|
| Completed sales totals and transaction count | `getHqDashboard` / `salesForScopeDay` | `sales` | `GET /api/v1/hq/dashboard?date=&outletId=&areaId=` | Single day only; partial |
| Cash and verified/unverified digital totals | `getHqDashboard` / `paymentTotals` | `payments` joined to sale IDs | Dashboard GET | Day-scoped; separate payment states; partial |
| Expenses and per-outlet expense totals | Dashboard model | `expenses` joined to `shifts` (uses explicit location or shift start location) | Dashboard GET; operational expense list | Daily dashboard aggregation only; partial |
| Outlet performance rows | Dashboard model | `sellingLocations`, `shifts`, `sales`, `expenses` | Dashboard GET | Cursor-paged single day; partial |
| Same-day hourly cumulative sales | `getSalesTrend` | `sales.occurredAt` and `businessDay` | Dashboard GET | Single business day; partial |
| Incident counts | HQ incident handler | `incidents` | `GET /api/v1/hq/incidents` | Organization-wide, all time; partial and not suitable for filtered reports |
| Download dashboard CSV | Dashboard read model + inline CSV encoding | Source operational maps; `auditEvents` | `GET /api/v1/hq/dashboard/export` | Audited but limited dashboard export; partial |
| Saved/scheduled export | None | No export/job storage model | None | Unsupported |

## Important semantics and boundaries

- Money is stored as integer IDR amounts. Sales reports should count only `COMPLETED` sales; drafts, voided and corrected records must not be silently treated as completed gross sales. Verified digital and pending/unverified digital totals must remain separate.
- Expenses are linked to a shift and business day. When an expense lacks an explicit selling location, the current dashboard code uses the shift's `startLocationId`; do not infer a later location without an explicit time/location relationship.
- Business-day semantics use `Asia/Jakarta` and the configured 04:00 cutoff. A report must label its selected business-day window and not substitute the browser's calendar date without validation.
- Outlet is presentation terminology; the runtime domain record is `SellingLocation`. An outlet filter is not authorization: every list, aggregate, and export must apply session-derived org/area/stall/self scope server-side.
- Incident records do not contain a persisted severity in the current adapter. Do not present severity buckets or incident SLA calculations as source-backed until those fields/rules exist.
- No cost-of-goods source supports a profit/margin claim. Any report must label only actual sales/expense arithmetic and must not invent profit.
- Exports contain operational/financial data. The existing export demonstrates an audited CSV pattern; a new report export should reuse the existing audit service and avoid client-generated CSV from the visible rows alone.

## Audit, security, and specification notes

- Relevant source rules include `docs/operations/API-READ.md`, `docs/security/PERMISSIONS.md`, `docs/product/HQ-DASHBOARD.md`, `SALES.md`, `EXPENSES.md`, and `INCIDENTS.md`.
- `TASKS.md` labels T-HQ-003 with “ADR-0021 (export audit)”, but the checked-in `ADR-0021-notification-channels.md` is about notification channels. The archive's Reports & Export prompt does not depend on that ADR number. Export auditing is also described in `HQ-DASHBOARD.md` and the general append-only rules in `docs/adr/ADR-0026-append-only-audit.md`; no contradictory page-08 instruction was found.
- The current auth adapter is fake in development and fails closed in production. Local fake-role tests can prove route policy branches, not production identity assurance.
- The store is a single-process JSON-backed pilot. This audit does not claim SQL query performance, multi-process consistency, or production-grade report/export durability.

## Scope boundary before implementation

Build a truthful `/reports` read surface from persisted sales, expenses, outlet, and incident fields the active adapter actually supports. Reuse the current business-day logic, authorization, resolver conventions, audit service, and file-backed store. Do not imply saved reports, scheduled jobs, customer analytics, profit margins, severity/SLA analysis, or a production database. Update the classifications above only after implementing and verifying the corresponding behavior; do not update `TASKS.md` to DONE from UI appearance alone.
