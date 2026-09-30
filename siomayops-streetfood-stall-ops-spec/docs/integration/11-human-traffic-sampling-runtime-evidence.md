# Page 11 — Human traffic sampling runtime evidence

**Date:** 2026-09-30 (Asia/Jakarta)
**Status:** Partial runtime proof; real browser camera capture/upload and production proof not performed. **T-TRAFFIC-001 remains NOT DONE.**

## Local application run

Started the real Next.js app bound to the preview interface with the development-only operator actor and page flag enabled:

```sh
FAKE_AUTH_ROLE=OPERATOR \
FAKE_OPERATOR_ID=00000000-0000-7000-0000-000000000010 \
TRAFFIC_SAMPLING_ENABLED=true \
corepack pnpm exec next dev --hostname 0.0.0.0 --port 3000
```

The app started on port 3000 (`Ready in 1437ms`; after restart `Ready in 1539ms`). `FAKE_AUTH_ROLE` is not production authentication.

## Browser permission response

```sh
curl -sSI http://127.0.0.1:3000/operator/traffic-sampling
```

Observed: `HTTP/1.1 200 OK`, `Permissions-Policy: geolocation=(), camera=(self), microphone=()`, and CSP with `media-src 'self' blob:`. The general `/operator` route returned `camera=()` and `microphone=()`. This verifies response headers only; it does **not** prove browser capture behavior.

## Authenticated API and persisted result

Initial request:

```sh
curl -sS http://127.0.0.1:3000/api/v1/operators/me/traffic-sampling
```

Observed HTTP 200 with a current active shift and server-derived location `Alun-alun Bandung`; `history: []` before the write.

Primary manual write:

```sh
curl -sS -X POST http://127.0.0.1:3000/api/v1/operators/me/traffic-samples \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 70000000-0000-7000-0000-000000000099' \
  --data '{"clientRequestId":"70000000-0000-7000-0000-000000000099","estimatedCount":7,"note":"Hujan ringan"}'
```

Observed HTTP 201 and `{ "estimatedCount": 7, "trafficBand": "STEADY", "videoStatus": "NOT_PROVIDED" }` with sample ID `533f458a-57ad-4921-a04d-18f4af4657ce`. Re-reading the endpoint showed that exact record in history for the derived location.

Invalid mutation:

```sh
curl -sS -o /tmp/traffic-invalid.json -w '%{http_code}' -X POST \
  http://127.0.0.1:3000/api/v1/operators/me/traffic-samples \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 70000000-0000-7000-0000-000000000098' \
  --data '{"clientRequestId":"70000000-0000-7000-0000-000000000098","estimatedCount":501}'
```

Observed `400` with `VALIDATION_FAILED`; no invalid count was persisted.

## Restart durability and privacy shape

Stopped the dev server process, started the same command again against the same ignored `data/db.json`, then re-read the Page 11 API. The same sample ID/count/band/note appeared after restart. A direct runtime inspection of `data/db.json` returned:

```json
{"count":1,"sampleId":"533f458a-57ad-4921-a04d-18f4af4657ce","band":"STEADY","hasOperatorId":false,"hasShiftId":false}
```

This proves durability for the local file-backed pilot, not for PostgreSQL or production. After the proof, the one temporary test sample was removed from ignored `data/db.json`; the unrelated local seed data was retained. The current running preview returns `environment: "DEVELOPMENT"` and an empty history, and the UI labels the outlet/shift fixture as development data.

## Analytics/log evidence

Posted an allowlisted explicit-start event:

```sh
curl -sS -X POST http://127.0.0.1:3000/api/v1/operators/me/traffic-sampling/events \
  -H 'Content-Type: application/json' --data '{"event":"traffic_sample_started"}'
```

Observed HTTP 202 `{ "accepted": true }`. Dev server logs contained `traffic_sampling_page_viewed`, `traffic_analysis_completed`, and `traffic_sample_started` with page, safe request ID, and event name only. Integration tests also prove upload success emits `traffic_sample_uploaded` once across an idempotent replay, and failures emit `traffic_analysis_failed` with a safe reason enum. No clip bytes, notes, operator ID, shift ID, or exact count were present in analytics log calls.

## Authorization/test evidence

`tests/integration/traffic-sampling-api.test.ts` proves invalid/no session returns 401, HQ role access/write returns 403, foreign organization scope returns 404, caller-supplied identity fields are rejected, cross-location media attachment is rejected, and manual count/media data are validated. No raw media read/download route exists. The running dev curl requests used the configured fake operator and do not substitute for a production identity test.

## Commands and results

- `corepack pnpm typecheck` — PASS.
- `corepack pnpm lint` — PASS.
- `corepack pnpm exec vitest run tests/unit/traffic-sample.test.ts tests/integration/traffic-sampling-api.test.ts` — PASS (13 tests: 3 unit + 10 integration).
- `corepack pnpm exec vitest run` — PASS (36 files, 182 tests).
- `corepack pnpm build` — PASS; Next.js 15.4.2 production build completed. Existing ESLint integration warning: Next.js ESLint plugin was not detected.
- `corepack pnpm check:stubs` — FAIL due many pre-existing project-wide Phase 0 marker/stub/forbidden-import findings; no Page 11 file remains in its finding list after updating the checker for the single explicit camera helper.
- `corepack pnpm check:docs` — FAIL on dangling ground-truth references for unrelated Pages 1–4 and 12–17; no Page 11 reference is reported.

## Not proven

No browser automation was run against camera permission, actual MediaRecorder output, a complete upload from a real clip, UI refresh after real upload, or console behavior. Playwright Chromium download previously failed with CDN TLS `ECONNRESET`. The runtime upload route was not sent a fabricated “video” just to claim success. Server-side encoded WebM duration inspection, streaming body-size enforcement, production authentication, PostgreSQL migration, production object storage, scheduled purge, and backup deletion remain release blockers.
