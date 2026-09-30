# Page 08 — Reports & Export runtime evidence

**Date:** 2026-09-30 (Asia/Jakarta)
**Environment:** local Next.js development server, fake development HQ operations session, isolated file-backed pilot store at `/tmp/siomayops-reports-runtime.json`. This is a synthetic local fixture, not production/customer data. No repository `data/db.json` was used for the run.

## Checks and exact results

Commands were run from `siomayops-streetfood-stall-ops-spec/`:

| Command/action | Result |
|---|---|
| `corepack pnpm typecheck` | PASS — `tsc --noEmit`, exit 0 |
| `corepack pnpm lint` | PASS — `eslint .`, exit 0 |
| `corepack pnpm test` | PASS — 30 test files, 149 tests passed |
| `corepack pnpm build` | PASS — Next.js 15.4.2 compiled and generated `/reports`, `/api/v1/reports`, and `/api/v1/reports/export`; exit 0. Build emitted the repository's existing warning that the Next.js ESLint plugin was not detected. |
| CI workflow | `.github/workflows/ci.yml` now has an application job running frozen install, typecheck, lint, Vitest, and production build. The remote job has not yet run. |
| `npm run check:docs` | FAIL — pre-existing dangling integration-ground-truth references for pages 01–04 and 09–17. On the first run it also noted this runtime-evidence document had not yet been created; after creation, only those unrelated page references remain. |
| `node -e '...playwright chromium.executablePath()...'` | Browser executable not installed; no real browser automation or browser-console inspection was performed. |

## Local runtime flow

An isolated JSON store was initialized with one completed sale (42,000 IDR minor units), one paid cash payment, one submitted shift expense (5,000), and one shift-linked incident, all associated with the same local business day. The app was started with:

```sh
SIOMAYOPS_DATA_FILE=/tmp/siomayops-reports-runtime.json \
FAKE_AUTH_ROLE=HQ_OPS \
FAKE_ORG_ID=00000000-0000-7000-0000-000000000001 \
npm run dev -- -H 0.0.0.0 -p 3012
```

Observed HTTP and data results:

- `GET /reports` → **200** and rendered the page heading `Laporan &amp; Ekspor`.
- `GET /api/v1/reports?dateFrom=2026-09-30&dateTo=2026-09-30` → **200**; returned `salesMinor=42000`, `completedTransactions=1`, `cashPaidMinor=42000`, `reportedExpensesMinor=5000`, `salesAfterExpensesMinor=37000`, `incidentCount=1`, and source watermark `2026-09-30T01:18:11.555Z`.
- `GET /api/v1/reports?dateFrom=2026-02-30&dateTo=2026-03-01` → **400** for invalid calendar date.
- `GET /api/v1/reports/export?dateFrom=2026-09-30&dateTo=2026-09-30` → **200**, `text/csv`, `private, no-store`, UTF-8 BOM bytes `ef bb bf`, five CSV lines (header, summary, daily, and two outlet rows).
- Direct inspection of the isolated persisted JSON after export showed one source sale and one `export.created` audit event.
- The development server was stopped and restarted with the same `SIOMAYOPS_DATA_FILE`; the same report GET returned **200** and `salesMinor=42000`, and direct store inspection still showed one export audit event. This demonstrates pilot file-store restart persistence for the local fixture only.
- Server logs showed `report_viewed`, `report_filter_changed`, `report_export_requested`, and `report_export_succeeded` with request IDs and allowlisted properties.

Automated boundary tests separately verified unauthenticated **401**, read-role denial **403** for export, cross-area/cross-tenant location rejection, invalid date/cursor **400**, and no export audit on denied export. These are fake-provider route tests; they are not production identity-provider evidence.

## Acceptance not claimed

The HTML/API/CSV flow and isolated persistence were exercised over HTTP, but no browser was available. Real browser control interaction, actual anchor download UX, visual/mobile review, and browser-console inspection remain unverified. Remote CI was not run. Production authentication, PostgreSQL behavior, production data, and multi-process durability are not evidenced here. Page 7 browser acceptance remains outstanding.
