# Dashboard UI Integration

**Document ID:** DOC-INT-DASHBOARD-UI-04
**Scope:** route `/` (`src/app/page.tsx`) only. `/hq` is not migrated.
**Status of `T-HQ-003`:** **NOT DONE** (see "Known Gaps").

## Previous State

`/` was a client component (`"use client"`) that rendered hard-coded operational values: KPI figures
(`Rp 8.450.000`, `187`, `Rp 1.275.000`, `8 / 9`), six invented outlets (Manggarai … Setiabudi), a fixed
chart polyline, three fixed alerts, four fixed activity rows, a fixed date and a fixed user
("Rizky Pratama"). Search was browser-only and both forms were simulations.

## New Data Flow

```text
Browser  GET /?date=YYYY-MM-DD&outletId=…
  → src/app/page.tsx (server component, force-dynamic)
      → createAuthPort().resolveSession()          401-equivalent: "Masuk diperlukan"
      → authorize(session, "hq:view")              403-equivalent: "Akses ditolak"
      → validate date / outletId                   400-equivalent: "Filter tidak valid"
      → getHqDashboard({ scope: session.scope, … })   src/features/hq/dashboard.ts
          → memoryStore (file-backed data/db.json)
  → <DashboardClient model viewer/>                (interaction only, no data fetching)
```

The page calls the same server-side query (`getHqDashboard`) that `GET /api/v1/hq/dashboard` calls, in-process,
instead of fetching its own API over HTTP. Scope always comes from the session; the URL can only narrow it.
There is no aggregation in React.

Files: `src/app/page.tsx`, `src/app/loading.tsx`, `src/app/_dashboard/{DashboardClient,States,Icon}.tsx`,
`src/app/_dashboard/format.ts`, `src/app/globals.css` (skeleton/state styles only).

## Static Data Removed

| Area | Now comes from |
|---|---|
| KPI (sales, transactions, average, expenses, ratio, active/total outlets) | `model.kpis` |
| Day-over-day change | `kpis.salesChangeBps` (`null` ⇒ "Belum ada pembanding") |
| Sales chart | `model.salesTrend` (cumulative, 06:00…18:00); axis ceiling derived from the data |
| Outlet table + count + operator + start time | `model.outlets`, `model.pagination.total` |
| Alerts | `model.alerts` (kind → Indonesian tag/icon in `format.ts`) |
| Activity feed | `model.activity` |
| Outlet selector options | `model.outletOptions` (already scope-filtered) |
| Header date, "dihitung" time | `model.scope.businessDay`, `model.generatedAt` (rendered in Asia/Jakarta) |
| User card | session role (no user name exists in `SessionContext`) |

Money stays integer rupiah (IDR minor = rupiah) until `rupiah()` formats it.

## Filters

| Control | Kind | Why |
|---|---|---|
| Date | **Server** (`?date=`) | Different business day = different authorized dataset; refresh/share/back safe. |
| Outlet | **Server** (`?outletId=`) | Unknown/unauthorized id ⇒ "Outlet tidak ditemukan"; the browser never receives other outlets' rows. |
| Search | Client | Narrows rows already authorized and bounded (server `limit=100`). |
| Status | Client | Same reasoning. Not an authorization mechanism. |

## Loading / Empty / Error

- **Loading:** `src/app/loading.tsx` skeleton in the existing shell; `aria-busy` during date/outlet transitions.
- **Empty day:** zeros, "Belum ada aktivitas operasional pada <tanggal>.", "Tidak ada perhatian khusus saat ini.", "Belum ada aktivitas operasional hari ini." No sample data.
- **Error:** "Data operasional tidak dapat dimuat." + **Coba Lagi** (`router.refresh`). Only a generic message is rendered; the server logs the message, never a stack, path or payload to the page.
- Other states: unauthenticated, forbidden, invalid filter, unknown outlet.

## Runtime Evidence (2026-09-29, `next dev`, real HTTP, no browser)

1. `GET /` with seeded data and no transactions ⇒ 200; KPI `Rp 0 / 0 / Rp 0 / 1 / 1`; shift from seed shown as operator "Budi".
2. Wrote data through the existing write APIs: `POST /api/v1/sales` (2 × Siomay Ayam @ Rp 15.000), `POST /api/v1/payments/cash` (PAID), `POST /api/v1/expenses` (Rp 5.000, PARKING).
3. `GET /` ⇒ KPI **Rp 30.000 · 1 transaksi · Rp 5.000 · 1 / 1**; activity contains "Mencatat pengeluaran" and "Mencatat transaksi".
4. Dev server stopped and restarted on a fresh process ⇒ identical values (file-backed `data/db.json`).
5. `GET /?date=2026-13-45` and `?date=2026-02-30` ⇒ "Filter tidak valid"; `?outletId=nope` ⇒ "Outlet tidak ditemukan".
6. `GET /api/v1/hq/dashboard?date=2026-09-29` returned the same numbers as the page.

**Not verified:** no browser could be installed in this sandbox (`npx playwright install chromium` fails with a download error), so
browser console, hydration warnings, client-side navigation on filter change, and the 390 / 768 / 1440 px layouts
were **not** observed. The server log showed no errors for the final code.

## Tests

`npx vitest run` ⇒ 23 files, 125 tests pass. New: `tests/unit/dashboard-format.test.ts` (5) and
`tests/integration/dashboard-page.test.tsx` (7: persisted values render and retired sample values are absent, empty day,
date/outlet reach the query, malformed date / unknown outlet, area-scope isolation, unauthenticated + forbidden, error state without leakage).
`vitest.config.ts` gained `esbuild.jsx = "automatic"` so `.tsx` server components can be rendered in tests. The page tests render
server HTML with `renderToStaticMarkup`; they do not exercise browser interactions.
`npx tsc --noEmit` passes. ESLint ignores `src/app` by repository config, so it was not applied there.

## Remaining Non-Persistent UI

- **Catat Transaksi / Catat Pengeluaran** modals are still simulations and say so ("Simulasi formulir — data belum dikirim ke server"). Outlet options are now real; nothing is saved.
- "Pengaturan" and "Bantuan" are inert and marked unavailable. Notification popover shows the real alerts but has no read/unread state.

## Known Gaps

- `T-HQ-003` still needs: real E2E tests (existing `tests/e2e/*` use literals), exception-first card ordering, two-click drill-down from every number, export audit tests against the UI, QA-H-01/02/06, and `/hq` migration. Drill-down from this page reaches `/hq/outlets/[id]` only.
- Alert/activity text (`description`) is produced by the read model in Indonesian; the UI maps only kind → icon/tag. Moving those strings to the UI needs a structured-payload change in `getHqDashboard`.
- Docs `02-dashboard-read-model.md` and `03-dashboard-server-boundary.md` from the earlier steps do not exist in the repository; the code they would describe does (`features/hq/dashboard.ts`, `api/v1/hq/dashboard`).
- Auth is the development fake port (`FAKE_AUTH_ROLE`, `FAKE_ORG_ID`); production resolves no session by design.
- Existing tests call `memoryStore.clear()`, which also rewrites `data/db.json`; do not run the test suite against a database whose contents you want to keep. `data/` is now git-ignored.
- Search box moved into the table only (top-bar duplicate removed); "Semua Outlet / Jakarta Selatan" fake toggle replaced by the real selector.
