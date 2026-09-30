# Page 12 — Weather & Site Suitability: runtime evidence

**Date:** 2026-09-30 (Asia/Jakarta)  
**Status:** Local development pilot proof only; not production or browser acceptance evidence.

## Runtime setup and read

Started Next.js with a separate ignored file-backed store so the proof did not modify the regular local seed file:

```bash
FAKE_AUTH_ROLE=OPERATOR \
FAKE_OPERATOR_ID=00000000-0000-7000-0000-000000000010 \
FAKE_ORG_ID=00000000-0000-7000-0000-000000000001 \
TRAFFIC_SAMPLING_ENABLED=true \
SIOMAYOPS_DATA_FILE=data/task12-runtime.json \
corepack pnpm exec next dev --hostname 0.0.0.0 --port 3000
```

- `GET /operator/site-condition` → **200**.
- `GET /api/v1/operators/me/site-condition` → **200**, `Cache-Control: no-store` and `Pragma: no-cache`; returned the seeded development active shift and `Alun-alun Bandung` context, no GPS sample, no existing observations, and explicitly `weather.status=UNAVAILABLE`, `reason=PROVIDER_NOT_CONFIGURED`, all measurement fields null.
- Returned `recentTraffic.status=EMPTY` and `recentSales.status=EMPTY` for the persisted seed state; no fallback operational values were displayed.

The UI marks this context as development fixture data. It is not evidence about the user's real outlet or current weather.

## Supported mutation and persistence

Sent an operator POST with `clientRequestId=70000000-0000-7000-8000-000000000021`, `groundCondition=WET`, `shelterStatus=NOT_AVAILABLE`, and bounded notes, with a matching `Idempotency-Key`:

- POST → **201** and returned the server timestamp plus observation fields.
- GET after write → **200**; history contains the saved row and `assessment.cue=REVIEW_SHELTER`, `reason=WET_GROUND_WITHOUT_SHELTER`, `source=OPERATOR_OBSERVATION_ONLY`, `weatherIntegrated=false`.
- Direct inspection of ignored `data/task12-runtime.json` found one persisted observation and one idempotency index entry. The API response omitted actor IDs; automated API tests assert the stored organization/operator/shift/location are server-derived. Runtime Pino event payloads contained no free-text notes; automated tests also assert note text is absent from audit summaries and analytics logs.
- Stopped and restarted the development server using the same file and operator context. GET after restart returned the same observation and cue; direct file inspection still showed the row and request index.
- Invalid `groundCondition=RAINING` → **400**; no additional record was created.

## Authorization and analytics

Restarted a separate development server with `FAKE_AUTH_ROLE=HQ_OPS` against the same file:

- `GET /api/v1/operators/me/site-condition` → **403**.
- `POST /api/v1/operators/me/site-condition` → **403**.

Server logs showed `site_condition_viewed`, `site_observation_saved`, `relocation_recommendation_viewed`, and `site_observation_save_failed` with safe request IDs and enum-only outcome/cue/reason properties. No notes, coordinates, actor IDs, location IDs, sale amounts, or traffic values appeared in these event payloads. Application logs showed successful 200/201/400/403 responses and no unexpected server exception during this runtime exercise.

## Browser limitation and cleanup

No browser flow or browser-console check was completed. `corepack pnpm exec playwright install chromium` failed because all Chromium CDN connections ended with TLS `ECONNRESET`; the browser binary is unavailable in this environment. Automated route/domain tests cover the API flow, but they do not replace browser acceptance proof.

After the evidence was collected, the isolated `data/task12-runtime.json` proof file was removed; it is ignored development data. A separate clean development store is used for the live preview. No production database, external weather provider, backup retention, or real production identity was involved.
