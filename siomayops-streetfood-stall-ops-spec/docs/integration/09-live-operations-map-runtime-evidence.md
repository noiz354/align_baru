# Page 09 — Live Operations Map runtime evidence

**Date:** 2026-09-30 (Asia/Jakarta)
**Route:** `/operations/map`
**Host:** local Next.js 15.4.2 development server on `0.0.0.0:3000`
**Fixture:** isolated file-backed development store at `/tmp/siomayops-map-runtime.json`; deterministic local seed only

## Checks performed

| Check | Result |
|---|---|
| `corepack pnpm typecheck` | Pass (`tsc --noEmit`) |
| `corepack pnpm lint` | Pass; existing ESLint warning says the Next.js plugin is not configured |
| `corepack pnpm test` | Pass: 32 test files, 156 tests |
| Focused map tests | Pass: 2 files, 7 tests |
| `corepack pnpm build` | Pass; `/operations/map` and both `/api/v1/operations/map` endpoints emitted successfully |
| `corepack pnpm check:docs` | Expected repository-wide failure: dangling ground-truth references for pages 01–04 and 10–17; Page 09 references resolve after this evidence file was added |
| `corepack pnpm check:stubs` | Fails repository-wide on existing Phase 0 markers/stub heuristics across implemented features; the new map routes are also caught by the checker. This is not a Task 9-specific test or runtime failure. |
| HTTP GET `/api/v1/operations/map?businessDay=2026-09-30` | `200`, `private, no-store`, one seeded marker, valid stored coordinates, active explicit location report, `OPERATING`, current report-age band, no operator identity fields |
| HTTP POST `/api/v1/operations/map/events` with `map_marker_opened` + `active_shift` | `202`; structured log emitted `map_marker_opened`, `page=operations-map`, generated request ID, coarse marker type only |
| HTTP GET `/operations/map` | `200`; Next.js returned the client-page shell. No browser hydration, tile request, layout, or interaction was inspected. |

The synthetic runtime response reported one visible and active point, one point with coordinates, zero stale reports, and zero linked open incidents. Coordinates and the active shift came from the deterministic development seed. No production or customer records were read or created. The identity omission check confirmed the JSON did not contain the seeded operator names, `operatorId`, or `phoneE164` strings. The map-data GET emitted `map_viewed` (and `map_filter_changed` for its business-day query); the event POST returned `202` and its structured log contained only `map_marker_opened`, fixed page, generated request ID, and `active_shift` marker type.

The runtime actor was the repository's development-only `HQ_OPS` fake session. `src/server/auth/port.ts` deliberately resolves no session in `NODE_ENV=production`; these checks do not demonstrate a production identity provider or deployment authorization setup.

## Acceptance boundary

This is API/build evidence only, not visual or browser acceptance. Browser automation was unavailable. In particular, map tile availability/attribution rendering, marker positioning at narrow widths, client hydration, keyboard/screen-reader behavior, and the external OpenStreetMap request were not tested. See `09-live-operations-map-gap-report.md` for remaining limits.
