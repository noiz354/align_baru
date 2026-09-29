# Dashboard / Operasional Hari Ini — Runtime Evidence

**Evidence date:** 2026-09-29 UTC
**Environment:** Node 22-compatible workspace, Next.js 15.4.2, development server on `0.0.0.0:3000`

## Local-equivalent checks

| Command | Result |
|---|---|
| `corepack pnpm run typecheck` | PASS (run after the production build completed) |
| `corepack pnpm run lint` | PASS; existing Next ESLint plugin warning only |
| `corepack pnpm test` | PASS — 22 files, 116 tests |
| `corepack pnpm run build` | PASS — Next production build completed and included `/api/v1/hq/dashboard` and `/api/v1/analytics` |
| `corepack pnpm exec playwright test tests/e2e/hq-coverage.spec.ts --project=hq-desktop` | NOT RUNNABLE — Playwright Chromium binary is unavailable in the sandbox; two tests failed at browser launch before the journey began |

The typecheck and build should be run sequentially in CI because Next can regenerate `.next/types` while `tsc` is scanning it.

## API read proof

With `corepack pnpm dev --hostname 0.0.0.0` running:

```text
curl -sS 'http://127.0.0.1:3000/api/v1/hq/dashboard?date=2026-09-29&limit=6'
→ HTTP 200
→ JSON envelope: data + meta
→ data.scope.businessDay: 2026-09-29
→ data.kpis: integer minor-unit fields
→ data.outlets: server-scoped rows
→ meta.freshnessBand: current
```

Observed in the local persisted pilot state: one visible outlet, one active shift, zero completed transactions, and no alerts. These are observations of the current store, not fabricated completion fixtures.

Area filter proof:

```text
GET /api/v1/hq/dashboard?date=2026-09-29&areaId=00000000-0000-7000-0000-000000000003&limit=6
→ HTTP 200
→ data.scope.areaId: 00000000-0000-7000-0000-000000000003
```

Malformed filter proof:

```text
GET /api/v1/hq/dashboard?date=not-a-day&limit=0
→ HTTP 400
→ error.code: VALIDATION_ERROR
```

Unauthenticated proof is covered by `tests/integration/dashboard-boundary.test.ts` by configuring an invalid development role:

```text
→ HTTP 401
→ error.code: UNAUTHENTICATED
```

## Analytics proof

```text
POST /api/v1/analytics
body: { event: "dashboard_viewed", page: "dashboard", businessDay: "2026-09-29", status: "ALL", hasSearch: false, outcome: "success" }
→ HTTP 202
→ data.accepted: true
→ structured server log eventName: dashboard_viewed
```

This proves the temporary validated logging seam only. It does not prove delivery to real telemetry. See `docs/analytics/01-dashboard.md`.

## Browser/runtime limitations

The page was requested successfully over HTTP and the API/read boundary was executed against the actual running server and file-backed store. Playwright could not launch because `/home/user/.cache/ms-playwright/.../headless_shell` is not installed. Therefore this document does not claim authenticated browser rendering, filter-click evidence, console cleanliness, reload/restart evidence, or screenshot evidence.

## Status conclusion

The dashboard read loop is implemented and locally testable against persisted pilot state. Because G-01 through G-04 remain open, the page status is `PARTIALLY_INTEGRATED`, not `VERIFIED`.
