# Page 08 — Reports & Export architecture

**Route:** `/reports`
**Status:** Implemented locally; browser acceptance and production authentication remain unverified.
**Canonical requirements:** `docs/product/end-to-end-pages/08-reports-export.md`
**Baseline audit:** `docs/integration/08-reports-export-ground-truth.md`

## Request and persistence flow

```text
ReportsPage (/reports)
  ├─ GET /api/v1/reports?dateFrom&dateTo&areaId&outletId&limit&cursor
  │    ├─ resolveSession() → authorize(hq:view, org target)
  │    ├─ reportReadQuerySchema (strict date/filter validation)
  │    ├─ getOperationalReport(session.scope, normalized filters)
  │    │    ├─ getHqDashboard(...) reuses visible area/outlet resolution
  │    │    └─ bounded aggregation over memoryStore sales/payments/expenses/incidents/shifts
  │    └─ JSON response + report_viewed / report_filter_changed structured events
  └─ GET /api/v1/reports/export?dateFrom&dateTo&areaId&outletId
       ├─ resolveSession() → authorize(hq:export, org target)
       ├─ reportExportQuerySchema (strict; no client pagination)
       ├─ getOperationalReport(..., limit: 5,000), reject incomplete export
       ├─ CSV escaping/formula neutralization + UTF-8 BOM
       ├─ writeAuditEvent(action=export.created, subject=operational_report_export)
       └─ no-store CSV response + request/success/failure telemetry

Authoritative pilot persistence is the JSON-backed `memoryStore`, using `SIOMAYOPS_DATA_FILE` when configured and otherwise `data/db.json`. It survives process restart in a single-process pilot. This page adds no tables or schema migrations. PostgreSQL is not the active report source.
```

## Read model and semantics

`src/features/reports/read-model.ts` is presentation-neutral. It returns integer IDR minor-unit aggregates, effective filters, business-day series, outlet rows, category/status counts, a source watermark, and freshness band. It does not format currency, mutate business records, or infer accounting profit.

- Both date endpoints are required together; accepted windows are valid, inclusive `Asia/Jakarta` business days, maximum 31 days. Omitted dates mean the latest seven business days.
- Completed sales only contribute sales and transaction counts. Their linked payments are split into cash paid, other paid/verified, and pending/unverified. Payment amounts remain separate from gross completed sale totals.
- Every business day in the selected range appears, including zero-value days.
- Reported expenses are attributed to the persisted explicit selling location or, when absent, to the linked shift's start location. All expense review states currently contribute; this is not a GL/reconciled expense report.
- Incidents are counted by their current persisted status and category on `createdAt`'s business day. A linked incident is attributed to its shift's start location. The data model does not preserve incident-time outlet/severity. Unlinked incidents appear only in organization-wide, unfiltered reports.
- `salesAfterExpensesMinor` is arithmetic sales minus all included reported expenses; it is deliberately not labelled profit or margin.
- Source reads enforce session-derived org/area/stall/self scope plus visible-location filtering. Area/outlet query filters narrow that scope; they never grant access.
- Outlet rows are deterministic by localized name then ID, cursor-based, default 25 and max 100 per read. A report may enumerate at most 5,000 visible outlets. Export asks for that bounded maximum and rejects an incomplete cursor result.
- Report query work is bounded by date span and visible outlet count. The pilot adapter scans in-memory maps; this is not a claim of indexed database query performance.

## UI field/action map

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Business-day period | `getOperationalReport` filters/series | Completed sales and shift business day; incident `createdAt` converted with configured Jakarta cutoff | `GET /api/v1/reports` | Session scope plus validated range | Implemented |
| Sales and transaction summary | Report read model | `sales` where status is `COMPLETED` | `GET /api/v1/reports` | Org/area/stall/self and visible location | Implemented |
| Cash/verified/unverified payment split | Report read model | `payments` joined to completed `sales` | `GET /api/v1/reports` | Parent sale must be in scoped completed sale set | Implemented |
| Reported expenses and sales-after-expenses | Report read model | `expenses` joined to `shifts`, optional explicit location | `GET /api/v1/reports` | Shift, outlet and business-day scope | Implemented with accounting limitation |
| Outlet performance and next-page action | `ReportOutletRow` + cursor | `sellingLocations`, `sales`, `payments`, `expenses`, `incidents` | `GET /api/v1/reports` | Visible outlet set; cursor must belong to exact filtered set | Implemented |
| Incident total/status/category counts | Report read model | `incidents`, optional linked `shifts` | `GET /api/v1/reports` | Linked records must resolve inside scope; unlinked rows only in unfiltered org report | Partial by source semantics |
| Download CSV | Report endpoint result and CSV encoder | Same report source records; append-only `auditEvents` | `GET /api/v1/reports/export` | Requires `hq:export`; report query uses session scope and no pagination | Implemented as immediate export |
| Reload, loading, validation, authorization/server error | Fetch/UI state | None | Report GET | Error response is server authoritative | Implemented |
| Saved/scheduled report, background export job | No supported domain object | None | None | N/A | Unsupported and omitted |
| Profit, margin, incident severity/SLA | No supported source or policy | None | None | N/A | Unsupported and omitted |

## Authorization and privacy

`resolveSession()` supplies the trusted tenant, roles and scope. Both handlers call `authorize` on the required HQ capability: `hq:view` for report reads and `hq:export` for CSV. `AREA_SUPERVISOR` can view but not export. No organization, actor or privileged flag is accepted from the request. The dashboard scope resolver rejects inaccessible location filters. Export failure/success event and audit payloads contain IDs, date bounds and row counts only; free-text row values are not written to telemetry/audit summaries. CSV text cells are quoted and values beginning with formula-capable prefixes are prefixed with an apostrophe.

Development auth is intentionally fake and production auth fails closed. Runtime role tests prove route policy branches, not production identity assurance. The JSON store is single-process pilot persistence, not a production durability/concurrency guarantee.
