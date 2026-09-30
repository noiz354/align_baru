# Page 08 — Reports & Export gap report

**Date:** 2026-09-30 (Asia/Jakarta)
**Route:** `/reports`
**Requirements:** `docs/product/end-to-end-pages/08-reports-export.md`
**Architecture:** `docs/integration/08-reports-export-architecture.md`

## Implemented and tested

- A real `/reports` client page fetches the scoped report API; it renders business-day filters, summary metrics, payment splits, daily series/table, outlet table/pagination, freshness metadata, loading/error/empty states and an immediate CSV download action.
- `GET /api/v1/reports` validates strict date/filter inputs and requires `hq:view`; the read model applies session organization/area/stall/self scope and validates outlet filters against visible locations.
- Deterministic completed-sale, linked-payment, shift/business-day expense, incident, filled-series, summary and outlet aggregates are computed from the persisted pilot store. Cursor pagination and a 5,000-outlet hard bound prevent an unbounded report/export.
- `GET /api/v1/reports/export` requires `hq:export`, independently computes the full bounded report, creates formula-neutralized UTF-8 CSV, writes `export.created` audit data, returns `private, no-store`, and emits request/success/failure events.
- Unit/read-model and API integration tests cover range rules, empty daily buckets, completed-only sales, payment status splits, expense/incident attribution, pagination at 106 outlets, role/scope/tenant filtering, invalid cursor/date, CSV formula safety, and export audit behavior.

## Source limitations retained in the UI and contract

| Capability | Limitation | Truthful treatment |
|---|---|---|
| Accounting profit or margin | No cost-of-goods or accounting rules exist | Show only `salesAfterExpensesMinor`, explicitly labelled as not profit/accounting |
| Expense recognition | Expenses are operator-reported and may not have been reviewed | Label totals as reported; include all persisted review states |
| Incident severity/SLA | No persisted severity or SLA rule | Omit severity/SLA and count only by available status/category |
| Incident location | Event-time outlet is not persisted | Linked incidents use shift start location; unlinked incidents are only included in organization-wide, unfiltered totals |
| Saved/scheduled reports or export jobs | No supported storage/workflow | Omitted; CSV is generated immediately per request |
| Production auth | Current provider is fake in development and fails closed in production | Automated authorization tests prove role/scope logic only, not identity-provider assurance |
| Production database scale/consistency | Active adapter is single-process JSON file-backed storage | No PostgreSQL migration or database-performance claim |

## Acceptance evidence still outstanding

- No browser automation/browser-console evidence was available in this environment. The actual rendered interaction flow, downloaded file behavior in a real browser, and mobile visual acceptance remain for browser verification.
- The current task's locally executed tests/typecheck/lint/build are documented in `08-reports-export-runtime-evidence.md`; remote CI has not been run.
- Runtime persistence evidence uses an isolated local JSON file, not production data. Production restart durability and multi-process behavior are not claimed.
- Page 7 browser acceptance remains outstanding; Page 8 work does not mark it complete.
