# Dashboard UI Integration

**Document ID:** DOC-INTEGRATION-04
**Status:** implemented, runtime-verified (read-only dashboard), and merged with `main`
**Last updated:** after merging `origin/main` into this branch, which landed the parallel dashboard
work described under "Previous State" and "Known Gaps".
**Related:** `docs/product/HQ-DASHBOARD.md`, `HQ.md`, `DESIGN.md` §4, `ARCHITECTURE.md` §7/§8,
`API.md`, `docs/operations/API-READ.md`, `TASKS.md` (T-HQ-001/002/003), `AGENTS.md`, and the repository harness document at the monorepo root

**Scope of this step:** turn the HQ dashboard from a client-rendered surface that mixed static
sample cards with browser-side re-derivation into a read-only dashboard rendered from persisted
data. Mutation, drill-down and export are explicitly **out of scope** and remain pending.

> **T-HQ-003 is NOT done.** Its definition (`TASKS.md`) requires the ten cards with
> exception-first ordering, two-click drill-down and audited export. This step delivers the
> read-only card surface rendered from real data; drill-down and export are untouched.

---

## Previous State

What `/hq` actually was at commit `bca4e69` (`src/app/hq/page.tsx`, 249 lines, `"use client"`):

| Aspect | Previous behaviour |
| --- | --- |
| Data access | The browser fetched five endpoints (`/api/v1/sales`, `/api/v1/hq/sales`, `/api/v1/stock`, `/api/v1/shifts`, `/api/v1/hq/cash-position`) in a `useEffect` |
| Aggregation | KPI arithmetic was re-derived **in the browser**: completed-sale totals, a fallback sum when the HQ card was empty, opening-cash accumulation, low/out stock counts |
| Fake values | Cards with no source at all rendered fixed text: `Stall ST-001 • Budi • Kas awal Rp 50.000`, `Pending review: 0`, `Flagged: 0`, `Terbuka: 0`, `Kritis: 0`, `Lokasi aktif: 1 — Alun-alun Bandung`, `• Tidak ada eksepsi` |
| Failure | `catch` blocks wrote zero-valued cards — a data failure was indistinguishable from a zero day |
| Filters | None. No date or outlet selector existed |
| Loading | Literal `"Loading..."` strings inside cards |

Two facts about the starting point matter for an honest record (both were verified at the fork
point `bca4e69`, before any later merge):

1. **The preceding integration documents did not exist when this branch was cut.** At `bca4e69`
   there was no `docs/integration/` directory at all: no ground-truth, no data-map, no read model
   with `salesTrend` / `outlets` / `alerts` / `recentActivity`, and no dashboard boundary. This step
   therefore **built the missing read model and boundary here** (decisions confirmed with the task
   owner) rather than consuming them.
   **Since then, `main` gained part of that work from other branches:** `docs/integration/00-dashboard-ground-truth.md`,
   `01-dashboard-data-map.md`, `dashboard-data-map.md`, a parallel read model
   (`src/features/hq/dashboard.ts` with `getHqDashboard` / `getHqOutletDetail`), outlet drill-down
   (`/hq/outlets/[outletId]`, `/api/v1/hq/outlets/[outletId]`) and an export route
   (`/api/v1/hq/dashboard/export`). This document records what *this* branch built; the two read
   models are **not consolidated** — see "Known Gaps".
2. **The dashboard surface is `/hq`, not `/`.** At the fork point `src/app/page.tsx` was the
   operator home (quick-action tiles: Mulai Shift, Jualan, Stok, Pengeluaran, Tutup Shift) with no
   KPI, table, chart or sample operational value, so it was left untouched. `main` has since
   replaced that file with a client-side dashboard that still renders a hardcoded outlet array and
   mock operational values; this branch deliberately does not touch it (see "Remaining
   Non-Persistent UI").

---

## New Data Flow

```text
Browser
  ↓  GET /hq?date=YYYY-MM-DD&outlet=<stallId>
Dashboard Page            src/app/hq/page.tsx          (Server Component)
  ↓  loadHqDashboard({ date, outletId })
Authenticated Server Boundary
                          src/server/dashboard/boundary.ts
                          • session via the existing auth port (no second auth flow)
                          • authorize(session, "hq:view", { org })
                          • Zod-validated date / outlet filters
                          • outlet validated inside the authorized scope
  ↓  getHqDashboardReadModel({ organizationId, areaId, outletId, businessDay })
Dashboard Read Model      src/features/hq/dashboard-read-model.ts
  ↓  scoped reads only
Persistence               src/server/db/memory-store.ts (file-backed pilot store)
  ↓
Rendered KPI / chart / outlet table / alerts / activity
```

The same boundary is exposed over HTTP as `GET /api/v1/hq/dashboard`
(`src/app/api/v1/hq/dashboard/route.ts`) so the contract is reachable for tooling and tests. The
page calls the boundary **directly** — there is no server-to-self fetch.

Two rules the read model exists to enforce:

- the page and its components compute **no operational figure**; they format what the read model
  returns (`HQ-DASHBOARD.md` §1, "nothing is computed inline");
- the read model carries **no presentation strings**. It returns types, codes and numbers;
  Indonesian wording lives in `src/app/hq/_lib/copy.ts`.

---

## Static Data Removed

| Category | Removed | Now driven by |
| --- | --- | --- |
| KPI values | The browser-side derivation of sales totals, transaction count and cash position; zero-valued fallback cards on error | `readModel.kpis` (sales, count, average, expenses, ratio, active/total outlets, method split) |
| Outlet rows | `Stall ST-001 • Budi • Kas awal Rp 50.000` (the only outlet line, rendered as text) | `readModel.outlets` (code, operator, shift start, sales, expenses, status) |
| Chart | None existed; the card grid had no time series | `readModel.salesTrend` (24 hourly buckets over the 04:00–03:59 business day) |
| Alerts | None existed | `readModel.alerts` (rule + persisted alerts, mapped to copy in the UI) |
| Activity | None existed | `readModel.recentActivity` (audit log scoped to the business day) |
| Other static cards | `Pending review: 0`, `Flagged: 0`, `Terbuka: 0`, `Kritis: 0`, `Terkirim: 0`, `Lokasi aktif: 1 — Alun-alun Bandung`, `Padat: 0`, `• Tidak ada eksepsi`, `Stok menipis 0 / Habis 0` | `expenseReview`, `incidents`, `closingCompleteness`, `locationUsage`, `exceptions`, `stockStatus` |
| Failure behaviour | `catch` blocks that wrote zeros (failure looked like a zero day) | Explicit problem states: `INVALID_FILTER`, `UNAUTHENTICATED`, `FORBIDDEN`, `UNAVAILABLE` |

Values named in the task brief — `Rp 8.450.000`, `187`, `Rp 1.275.000`, `8 / 9` — do **not** appear
anywhere in this project (verified by `rg`; see "Runtime Evidence"). They are still listed here
because they were part of the brief, not because they were found.

What intentionally remains static: column headings, card titles, the alert/activity phrase
dictionaries, and the `—` empty marker. Those are labels, not operational records.

---

## Server Data Binding

| UI element | Read-model field | Notes |
| --- | --- | --- |
| Penjualan Hari Ini | `kpis.salesToday` | Completed sales only. Method split (cash / digital verified / digital unverified) is listed separately and **never** merged into this figure |
| Transaksi | `kpis.transactionCount` | Completed sales |
| Rata-rata Transaksi | `kpis.averageTransaction` | `null` when there are no transactions → `—`, never `Rp 0` |
| Pengeluaran | `kpis.expenses` | Scoped to the day's shifts |
| Rasio Pengeluaran | `kpis.expenseRatioPercent` | Single rounding step; `null` when sales are zero → `—` |
| Outlet Aktif / Total Outlet | `kpis.activeOutlets` / `kpis.totalOutlets` | Active = a shift exists for the day with `OPEN`/`PENDING_SYNC`/`DRAFT_OFFLINE`; total = `ACTIVE` outlets in scope |
| Sales chart | `salesTrend.points` | Always 24 chronological buckets; `unbucketedCount` reports sales that cannot be placed on the axis instead of hiding them |
| Outlet table | `outlets[]` | `OutletStatus` union → Indonesian label; missing operator renders `—` |
| Alerts | `alerts[]` | `DashboardAlertType` + `severity` + structured `context` → copy via `_lib/copy.ts` |
| Recent activity | `recentActivity[]` | Audit `eventType` → Indonesian phrase; unknown actions degrade to "mencatat aktivitas operasional"; no actor names, no per-person timeline (`HQ-DASHBOARD.md` §3.6) |
| Operational cards | `coverage`, `cashPosition`, `verificationBacklog`, `stockStatus`, `expenseReview`, `incidents`, `closingCompleteness`, `locationUsage`, `exceptions` | Each carries `computedAt` + freshness band, rendered by the existing `FreshnessBadge` |

Money formatting is unchanged: `MoneyText` → `formatMoneyForOperator` (Intl `id-ID`), so
`8450000` renders as `Rp 8.450.000`. The underlying `Money` minor-unit value is never mutated.

Additional honesty rules encoded in the read model:

- unverified digital money is counted in the method split even when its sale has not completed, and
  is never added to the headline (in the runtime run below, headline `Rp 85.000` vs unverified
  `Rp 108.000` — the operator sees both numbers, and they do not silently merge);
- alerts and the activity feed are scoped to the selected business day, so a quiet day shows a
  quiet dashboard;
- each alert gets a deterministic id (`TYPE:subjectId`), so re-renders cannot duplicate it.

---

## Date Filter

**Server-backed.** The control writes URL state and re-renders the Server Component:

```text
/hq?date=2026-09-01
```

- invalid or impossible dates (`2026-02-30`, `2026-9-1`, `not-a-date`) return `INVALID_FILTER` and
  render "Filter tidak dikenali." with a scope-safe reset link — never a guessed date;
- the default (no `date` parameter) is the server-derived business day from
  `shared/time/business-day.ts` (Asia/Jakarta, 04:00 cut), not the browser clock;
- because the selection lives in the URL, the view is refresh-safe, shareable and browser-back
  friendly.

## Outlet Filter

**Server-backed.** `?outlet=<stallId>` — "Semua Outlet" omits the parameter and returns the
aggregate authorized scope.

- the boundary validates the requested outlet **inside** the caller's scope; an unauthorized or
  unknown outlet returns `INVALID_FILTER` instead of falling back to organization-wide data, so
  no unauthorized rows are ever loaded and filtered later in the browser;
- a stall-scoped session is pinned to its own outlet.

## Client-only Filters

Two controls deliberately do not touch the server:

- **outlet search** (code / operator / status label),
- **status filter** (derived from the returned rows).

They narrow a list the server already scoped and authorized. Consistent with `HQ-DASHBOARD.md` §3.4,
client-side filtering is treated as presentation only and never as an authorization boundary.

---

## Loading State

`src/app/hq/loading.tsx` — a Server Component skeleton in the shape of the real dashboard (header,
filter bar, seven KPI tiles, chart, card grid) with `aria-busy` and `aria-live="polite"`. It shows
**no figure at all**: a placeholder that reads like a number is the exact failure mode this step
removes. The filter controls dim themselves during a client transition (`useTransition` /
`aria-busy`) so a slow server render is visible rather than looking like a lost click.

## Empty State

Verified on a real business day with no activity (`/hq?date=2026-09-01`):

| Element | Rendered |
| --- | --- |
| Penjualan | `Rp 0` |
| Transaksi | `0` |
| Rata-rata | `—` (with "Belum ada transaksi") |
| Rasio Pengeluaran | `—` (with "Butuh penjualan untuk dihitung") |
| Pengeluaran | `Rp 0` |
| Outlet rows | Valid rows, operator `—`, status `Belum mulai` |
| Chart | Flat zero baseline + "Belum ada transaksi pada tanggal ini." |
| Alerts | `Belum memulai operasional` for idle outlets (rule), or "Tidak ada perhatian khusus saat ini." when there are none |
| Activity | "Belum ada aktivitas operasional pada tanggal ini." |
| Eksepsi | "Tidak ada eksepsi." |

No sample data appears in any empty state.

## Error State

Three layers, none of which renders stale figures:

| Layer | Trigger | Rendered |
| --- | --- | --- |
| `INVALID_FILTER` (in-page) | Bad date or out-of-scope outlet | "Filter tidak dikenali." + reset link + request id |
| `UNAUTHENTICATED` / `FORBIDDEN` (in-page) | No session / role without `hq:view` | "Tidak ada sesi aktif." / "Peran Anda tidak dapat membaca dashboard ini." — both point at the existing auth flow, and `FORBIDDEN` deliberately offers no retry |
| `UNAVAILABLE` (in-page) | The read model throws (data layer unavailable) | **Data operasional tidak dapat dimuat.** + **Coba Lagi** (same URL) + request id |
| `src/app/hq/error.tsx` | An unexpected render/streaming failure | Same dashboard-level copy + `Coba Lagi`; only the framework digest is shown, never the error object |

None of these paths prints a stack trace, a file path, a database location, a secret or a raw
internal error message.

## Authentication Behavior

- The boundary uses the project's existing auth port (`createAuthPort`) and the existing
  `hq:view` action — no second auth flow was introduced.
- **Authenticated:** default fake-provider session (`HQ_OPS`) renders the dashboard.
- **Unauthenticated:** `resolveSession()` returning `null` yields `UNAUTHENTICATED` (covered by
  `tests/integration/hq-dashboard-boundary.test.ts`). This is no longer hypothetical: as of the
  merged `main`, the auth port **fails closed under `NODE_ENV=production`**, so a production server
  renders the "Tidak ada sesi aktif." state on `/hq` and answers `401 UNAUTHENTICATED` on the
  dashboard API — verified against a production build after the merge. In development the
  configurable pilot actor is used instead, which is the environment the runtime evidence below
  was captured in.
- **Forbidden:** verified in the running app with `FAKE_AUTH_ROLE=OPERATOR` — `/hq` renders the
  forbidden state and `GET /api/v1/hq/dashboard` returns `403 FORBIDDEN`.
- **Expired session:** not implemented anywhere in the project (no session TTL, no revocation
  surface); the dashboard inherits whatever the auth port does. Recorded as a known gap.

## Runtime Evidence

Environment: this sandbox, Node v22.22.3 (project declares `>=20`), production build
(`npm run build` → `next start`), file-backed pilot store.

Before the merge (branch as reviewed):

```bash
npm run typecheck                     # PASS
npm run lint                          # PASS
npm test                              # 24 files, 155 tests passed
npm run build                         # ✓ Compiled successfully; /hq is ƒ (server-rendered on demand)
node tools/verify-hq-dashboard.mjs    # 33 passed, 0 failed, 0 skipped
```

After merging `origin/main` into the branch (merged tree, dev server for the pilot actor):

```bash
npm run typecheck                     # PASS
npm run lint                          # PASS
npm test                              # 25 files, 160 tests passed (155 + 5 from main's unit suite)
npm run build                         # ✓ Compiled successfully; /hq and main's dashboard routes all build
node tools/verify-hq-dashboard.mjs    # 33 passed, 0 failed, 0 skipped (unchanged)
```

Post-merge smoke over both surfaces (development): `/` 200, `/hq` 200, `/hq/outlets/[outletId]` 200,
`/api/v1/hq/dashboard` 200, `/api/v1/hq/dashboard/export` 200 (CSV), `/api/v1/hq/sales` 200.
`/api/v1/hq/outlets/[outletId]` answered 404 for the seeded outlet, which is that route's own
not-found logic (the file is byte-identical to `main`) and not a merge regression.

Production build with the merged auth port (which fails closed): `/`, `/hq` and
`/hq/outlets/[outletId]` render their unauthenticated states, and `/api/v1/hq/dashboard`,
`/api/v1/hq/dashboard/export`, `/api/v1/hq/outlets/[outletId]` all answer `401`.

`tools/verify-hq-dashboard.mjs` creates real records through the app's own APIs and derives every
expectation from the API before/after delta, so it carries no fixture data of its own:

```text
PASS  sales KPI grew by exactly the recorded sale — 70000 → 85000 (+15000, expected +15000)
PASS  transaction count grew by one — 2 → 3
PASS  expenses KPI grew by exactly the recorded expense — +7000
PASS  unverified digital grew by exactly the recorded digital payment — +36000
PASS  unverified digital is never merged into the headline figure — headline 85000, ways 85000/0/108000
PASS  trend points sum to the headline sales figure — trend 85000 vs KPI 85000
PASS  activity feed contains the new events — 10 → 15
PASS  an activity-free day still answers with zeroes and valid outlet state — outlets=1, sales=0
PASS  an impossible date is rejected, not guessed — HTTP 400
PASS  an out-of-scope outlet is rejected — HTTP 400
PASS  error responses leak no internals — no stack/path/secret fragments
PASS  browser renders the persisted sales KPI — Rp 85.000
PASS  no previous sample value is rendered — none
PASS  date filter drives the server query — http://localhost:3000/hq?date=2026-09-01
PASS  outlet filter drives the server query — …?date=2026-09-29&outlet=00000000-0000-7000-0000-000000000020
PASS  reload renders the same figures — 4 → 4 occurrences
PASS  renders at 390px without page overflow — overflow=0px
PASS  renders at 768px without page overflow — overflow=0px
PASS  no console errors or warnings — clean
PASS  no uncaught page errors — clean
```

Browser: headless Chromium via `puppeteer-core` + `@sparticuz/chromium`
(the repository harness document, §3 — the Playwright CDN is unreachable in this sandbox, so
`npx playwright install` fails; the npm-registry browser is the working path). Neither package is a
project dependency, so the script reports SKIPPED (exit 2) rather than a pass when they are absent.

Additional runtime observations:

- **Persistence survives a process restart:** after stopping and restarting `next start`, the
  dashboard reported the same figures (`sales 55000`, `transactions 1`, `expenses 15000`,
  `unverified digital 36000`, outlet `ST-001 Budi OPEN`, 1 alert, 5 activity events).
- **Unhydrated server HTML carries the real values too:** `curl /hq` returns `Rp 35.000` in the
  streamed markup, so the figures are not a client-side afterthought.
- **Only one aborted request** appeared in the browser network log, a `net::ERR_ABORTED` on an
  in-flight `_rsc` prefetch that the next navigation superseded — not a failed data request. No
  hydration warnings were emitted.

## Remaining Non-Persistent UI

The dashboard itself is read-only, and its UI says so (`baca saja`, "Daftar ini hanya menampilkan
peringatan; tindak lanjut (drill-down) belum tersedia", "Drill-down dan ekspor belum tersedia"). The
"Aksi Cepat" links carry an explicit note that their destination pages are still static.

| Surface | State | Evidence |
| --- | --- | --- |
| `/hq` alerts / activity / table | Read-only by design in this step | Drill-down and export are not implemented |
| `/hq/expenses`, `/hq/incidents` | Static sample rows and buttons (`Review`, `Acknowledge`, `Resolve`) with no handler | `rg -n "<button" src/app/hq/expenses/page.tsx src/app/hq/incidents/page.tsx` |
| `/hq/verification` | Static copy only | No data binding |
| `/expenses` form | **Does not persist.** The page posts `categoryId` + nested `amount`, while `POST /api/v1/expenses` requires `categoryCode` + `amountMinor` → `400 VALIDATION_ERROR` (verified by request) | Pre-existing; not modified by this step |
| `/sell` "Catat Pengeluaran" | Navigates to `/expenses` (see above); the button persists nothing itself | `src/app/sell/page.tsx` |
| `/sell` "QRIS Static" | Shows an `alert()` about showing a QR; creates no payment record | `src/app/sell/page.tsx` |
| `/sell` "Bayar Tunai" | Posts `/api/v1/sales` + `/api/v1/payments/cash`; not exercised end-to-end in this step | Same endpoints the runtime proof called directly |
| `/closing`, `/alerts` | No `fetch` at all — static screens | `rg -c 'fetch\(' src/app/closing/page.tsx src/app/alerts/page.tsx` |

There is no "Catat Transaksi" or "Catat Pengeluaran" button on the dashboard surface, and none was
added: the dashboard is intentionally a read surface until mutation integration is its own task.

One additional static surface arrived with the merge and is **recorded, not fixed**: `main`'s
`src/app/page.tsx` is a `"use client"` dashboard whose `const outlets = [...]` array and KPI cards
are still hardcoded samples, so the app's root path shows operational values that do not come from
persistence. It is owned by whoever wrote it and is out of scope for this change; leaving it
untouched keeps this PR to one transition (the HQ dashboard) instead of two.

## Known Gaps

1. **T-HQ-003 remains open.** Drill-down (every number to its records), exception-first ordering of
   the ten cards, and audited export are not implemented.
2. **Mutation is not integrated.** The next task is to make a real transaction creation flow persist
   through the existing sale/payment endpoints and have the dashboard reflect it.
3. **`LOW_STOCK_QTY` has no single home.** The dashboard carries `LOW_STOCK_QTY = 10`, the same rule
   the previous page applied inline; it belongs with the other configurable thresholds in
   `/api/v1/config/thresholds`. The cash-variance tolerance *is* taken from that route's default.
4. **Two stock conventions coexist.** `deriveStockPosition` (`src/domain/inventory/variance.ts`)
   changes the running quantity for `COUNT`, while `GET /api/v1/stock` sums raw movements. The
   dashboard follows the endpoint's convention (so the card matches the stock page); the divergence
   should be settled in one place.
5. **Read models are not yet precomputed.** `HQ-DASHBOARD.md` §1 asks for stored read models with
   `computedAt` + `sourceWatermark` (`T-HQ-002`); this implementation computes on request from the
   pilot store and returns `computedAt` + freshness, but there is no job-produced snapshot and no
   watermark yet.
6. **Session expiry has no implementation anywhere.** As above, the dashboard inherits the auth
   port's behaviour; there is no TTL to test against.
7. **Two read models coexist after the merge, and that is a real gap.** `main` provides
   `src/features/hq/dashboard.ts` (`getHqDashboard`, `getHqOutletDetail`) serving `/hq/outlets/[outletId]`,
   `/api/v1/hq/dashboard/export` and the `00`/`01` data-map docs; this branch provides
   `src/features/hq/dashboard-read-model.ts` + `src/server/dashboard/boundary.ts` serving `/hq`.
   Both aggregate the same persisted facts and they read better together than apart. The only
   conflicting path was `GET /api/v1/hq/dashboard`; the merge kept this branch's contract because
   nothing outside this branch's own tooling consumes that HTTP route (`main`'s export and
   drill-down routes import the model functions directly). Consolidating the two models into one
   aggregation path is the natural follow-up and is **not** done here.
8. **Drill-down and export exist on `main` but are not wired into this `/hq` card surface.** The
   ten cards on this page still have no per-figure drill-down link, and the page renders main's
   `outlets/[outletId]` and `dashboard/export` endpoints nowhere. `T-HQ-003` therefore stays open:
   its definition requires the cards themselves to drill through and export to be audited.
8. **Pre-existing gate failures unchanged:** `npm run check:stubs` failed before this work and still
   fails (311 → 365 violation lines; +54, all of them from the new dashboard files, most of which
   require every source file to be a `PHASE 0` stub). `npm run census` also failed before this work
   (an existing root status document cites a requirement id that is absent from `PRD.md`). Neither gate can be made
   green by writing real code, and neither was worked around. `npm run check:docs` and the
   repository-level `node scripts/check-claims.mjs` pass.
