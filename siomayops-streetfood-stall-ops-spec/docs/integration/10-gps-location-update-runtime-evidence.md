# Page 10 — GPS / Current Location Update runtime evidence

**Date:** 2026-09-30 (Asia/Jakarta)
**Environment:** Local Next.js development server, fake OPERATOR session, file-backed pilot store at `/tmp/siomayops-task10-runtime.json`. No production authentication or real device GPS is represented.

## Server and page response

Started the application on `0.0.0.0:3002` with:

```sh
FAKE_AUTH_ROLE=OPERATOR \
FAKE_OPERATOR_ID=00000000-0000-7000-0000-000000000010 \
FAKE_ORG_ID=00000000-0000-7000-0000-000000000001 \
SIOMAYOPS_DATA_FILE=/tmp/siomayops-task10-runtime.json \
corepack pnpm exec next dev --hostname 0.0.0.0 --port 3002
```

Observed `✓ Ready`. `GET /operator/location` returned `200` with security headers including `Permissions-Policy: geolocation=(self)` for the page route. The client-rendered page includes the Page 10 title and privacy notice. `GET /api/v1/operators/me/location` returned `200`, `Cache-Control: private, no-store`, the seeded operator's active shift, current selling point, and one same-area choice.

The `/api/v1` response retains the global `Permissions-Policy: geolocation=()`; geolocation is enabled only for the page route, where the browser API is invoked.

## Persist → read → restart proof

A local development request submitted the seeded operator's explicit `CONFIRM_UNCHANGED` report with an idempotency key equal to `clientReportId` and a fresh test sample. Exact response:

```text
{"locationReportId":"00000000-0000-7000-0000-000000000031","gpsSampleStored":true}
HTTP 201
```

Direct inspection of the configured pilot JSON data file confirmed the existing report remained and its `gpsSample` held `accuracyMeters: 18` and the ISO capture time. A subsequent self-scoped GET returned `gpsSamplePresent: true` and `accuracyMeters: 18`.

The dev server was stopped and restarted on the same port with the same `SIOMAYOPS_DATA_FILE`. After restart, the same self-scoped GET still returned the persisted sample and accuracy; direct file inspection confirmed both the GPS sample and operational selling-point report remained. This proves restart durability for the local file adapter only.

## Focused tests and local CI-equivalent checks

| Command | Result |
|---|---|
| `corepack pnpm typecheck --pretty false` | PASS |
| `corepack pnpm vitest run tests/unit/location-gps.test.ts tests/integration/location-api.test.ts` | PASS — 13 tests |
| `corepack pnpm test` | PASS — 34 test files, 169 tests |
| `corepack pnpm lint` | PASS |
| `corepack pnpm build` | PASS — Next.js production build; `/operator/location` and both Page 10 API routes included |
| `corepack pnpm census` | PRE-EXISTING FAILURE — orphan `NFR-SEC-021` references in `IMPLEMENTATION_STATUS.md` and `docs/integration/05-transactions-runtime-evidence.md`; census reports 131/131 P0 task coverage, 39 ADR records, 0 `NotImplemented` stubs |
| `corepack pnpm check:docs` | PRE-EXISTING FAILURE — dangling audit-doc references for Pages 01–04 and 11–17; Page 10 has no dangling-reference failure |
| `corepack pnpm check:stubs` | PRE-EXISTING repository-wide Phase 0 heuristic failures across implemented pages/routes/features; the checker did not report a forbidden geolocation reference outside the exact Page 10 helper, nor `watchPosition` |

API integration tests include unauthenticated denial, cross-operator shift-write denial, cross-tenant denial, cross-area selling-point denial, invalid/stale sample validation, idempotent replay, and strict telemetry payloads. Domain tests include freshness/range validation, self-scope/area-bounded read, purge behavior, one-shot browser-helper invocation, and permission-denial classification.

## Browser evidence limitation

A browser-level run and inspection of the hydrated mobile UI, actual permission prompt/denial fallback, browser console, and live preview user journey were **not completed**. Playwright had no installed Chromium binary; `corepack pnpm exec playwright install chromium` failed because the browser CDN TLS connection reset (`ECONNRESET`). The page is available in the live preview for manual verification, but this limitation remains an acceptance gap. The curl/API flow is not claimed as browser evidence.

## Server logs

The development server log showed successful page/API compilation, `GET /operator/location 200`, `GET /api/v1/operators/me/location 200`, the successful report `POST ... 201`, and enum-only `location_page_viewed`/`location_saved` analytics without raw GPS fields. No server exception was observed during this run.

## Evidence boundary

This is local pilot-adapter evidence using fake authentication and a test coordinate, not production authentication, production SQL, a scheduled retention worker, backup deletion, privacy approval, or real-device GPS/browser evidence. T-LOC-004 remains open.
