# Page 12 — Weather & Site Suitability: ground truth audit

**Date:** 2026-09-30 (Asia/Jakarta)  
**Canonical prompt:** `docs/product/end-to-end-pages/12-weather-site-suitability.md`  
**Route:** `/operator/site-condition`  
**Audit posture:** inspect actual route, service, persistence, auth, and tests before implementation; no Page 12 code existed at audit time.

## Existing capability inventory

| Capability | Status | Implementation truth |
| --- | --- | --- |
| Page route and UI | `MISSING` | No `/operator/site-condition` route or client exists. |
| Current location | `IMPLEMENTED` | `getOperatorLocationContext` in `src/features/locations/index.ts`, called by the authenticated operator self route. It derives current location from the active shift/open location report and returns location ID/name/status, not coordinates. An absent shift yields a real empty context. |
| Weather provider/source | `MISSING` | No weather provider, adapter, fetch job, source attribution, or persisted weather observation exists. Do not invent temperature, rainfall, forecast, source, or a location-derived substitute. The Page 10 GPS fix is sensitive and must not be forwarded to a new external provider without an approved data flow. |
| Recent traffic sample | `PARTIAL` | Page 11's `getTrafficSamplingPage` reads the latest same-location sample history from the file-backed store. The feature is production-hard-disabled pending its own privacy and purge gates, and data is not an independent weather signal. Any display must identify it as a recent manual traffic estimate, not weather or a recommendation input unless explicitly documented. |
| Recent sales | `PARTIAL` | `StoredSale` includes `sellingLocationId`, but the original `listTransactions` projection omits it. Page 12 preserves that public projection and, inside its self-scoped feature read, intersects the bounded authorized transaction rows with the persisted sale's shift and selling-location keys. |
| Existing site observations | `MISSING` | No site-condition domain entity, write/read service, API route, or persistence map exists. |
| Ground wet/dry report | `MISSING` | No persisted wet/dry observation contract or state transition exists. |
| Shelter notes | `MISSING` | No persisted shelter availability/note fields exist. |
| Relocation decision note | `MISSING` | Page 10 records movement reports/reasons, but no Page 12 decision-note entity or write path exists. A note must not itself change the current location. |
| Suitability indicator/scoring rule | `MISSING` | No established scoring/recommendation model exists. Existing location operational status and traffic bands are not weather suitability scores. |
| Page 12 analytics | `MISSING` | No `site_condition_viewed`, `site_observation_saved`, or `relocation_recommendation_viewed` event exists. Structured Pino logging and safe request IDs are available. |
| Operator authorization foundation | `IMPLEMENTED` | `SessionContext`, `resolveSession`, `authorize`, self scope, and `OPERATOR` role exist. `location:view` is already available, but a distinct Page 12 create/view permission does not exist. Current auth is a development fake only; production auth fails closed. |
| Runtime persistence | `IMPLEMENTED` | The authoritative pilot runtime store is `memoryStore`, file-backed at ignored `data/db.json`; its maps serialize/reload across process restart. `src/server/db/schema.ts` is a schema catalogue, not a deployed migration or production database repository. |
| Automated Page 12 tests/runtime evidence | `MISSING` | No Page 12 unit, integration, browser, or runtime evidence exists. |

## Baseline data-flow contract

| UI field/action | Existing domain source | Existing persistence source | Existing server entrypoint | Scope | Baseline status |
| --- | --- | --- | --- | --- | --- |
| Current outlet/shift | `getOperatorLocationContext` | shifts, location reports, selling locations | `GET /api/v1/operators/me/location` | Authenticated operator self | `IMPLEMENTED` |
| Weather/source/freshness | None | None | None | N/A | `MISSING`; show unavailable rather than a mock |
| Recent traffic | `getTrafficSamplingPage` | traffic sample map in `memoryStore` | `GET /api/v1/operators/me/traffic-sampling` | Operator self and current location | `PARTIAL`; Task 11 production gate remains |
| Recent sales | Existing self-scoped `listTransactions` projection plus an internal persisted-sale location check in the Page 12 service | sales/payments/shifts in `memoryStore` | Page 12 GET through the existing transaction query | Session scope; active shift + current location filter | `PARTIAL`; linked site rows available, capped/limited query, no location ID added to the public transaction projection, no sales-based suitability rule |
| Wet/dry and shelter observation | None | None | None | N/A | `MISSING` |
| Shelter note | None | None | None | N/A | `MISSING` |
| Relocation decision note | Page 10 movement is a distinct action, not a note | location reports | `POST /api/v1/shifts/{shiftId}/location-reports` | Owning operator/shift | `MISSING` for Page 12; do not trigger a move |

## Persistence facts

```text
AUTHORITATIVE STORE: file-backed memoryStore at ignored data/db.json (pilot only)
READ PATH: server-side feature/query functions; existing current-site read is getOperatorLocationContext
WRITE PATH: no Page 12 write path exists at audit time
PRIMARY KEYS: existing rows use generated UUIDs; no site-observation key exists
FOREIGN/DOMAIN RELATIONSHIPS: sellingLocation → organization/area; active shift → operator/stall; stored sale has shift and sellingLocation IDs, but the original transaction read model omitted the location ID
INDEX/LOOKUP NEEDS: current active site by operator/shift; bounded newest-first site observations; idempotency by organization + request key
RESTART DURABILITY: file-backed maps reload after process restart in the pilot; no SQL migration or production repository is deployed
```

## Safe interpretation for the slice

The page can truthfully show server-derived active-site context, a separately labelled recent manual traffic estimate when present, and recent sales filtered to the persisted active-shift and selling-location IDs. It must show weather data/source as unavailable until an approved provider and its privacy/data-flow requirements exist. An observation-only cue may be implemented only if its inputs, freshness threshold, and human-decision limits are explicit and tested; it must not masquerade as a forecast or silently execute relocation.

## Page 12 pilot implementation inventory (after the baseline audit)

| Capability | Status | Current code/runtime truth |
| --- | --- | --- |
| Page route/UI | `PARTIAL` | `/operator/site-condition` now reads the authenticated API, supports manual observation, loading/error/empty states, and clearly labels development fixture context. No browser proof has been completed yet. |
| Current location and shift | `IMPLEMENTED` | Reuses `getOperatorLocationContext`; Page 12 response projects only name/status and shift business-day/stall context and excludes any GPS sample/coordinates. |
| Weather source/data | `UNSUPPORTED` | `unavailableWeatherAdapter` returns null values and `PROVIDER_NOT_CONFIGURED`; there is no source, network request, forecast, or weather observation persistence. |
| Recent traffic sample | `PARTIAL` | Reuses Task 11 same-location history only when its feature flag is enabled; rows omit media notes/IDs and are explicitly labelled manual estimates. Task 11 remains production-disabled. |
| Recent sales | `PARTIAL` | Uses `listTransactions(session, { businessDay, limit: 100 })`, then internally checks each already-authorized row's persisted sale for matching `shiftId` and `sellingLocationId` against the session-derived active shift/current location and returns at most five rows. The 100-row cap is reported; the location ID is not added to the public transaction projection and sales do not affect the cue. |
| Site observation / wet-dry / shelter / decision note | `IMPLEMENTED` | `createSiteConditionObservation` accepts strict manual fields, derives org/operator/shift/location from session and open location report, persists with idempotency, writes a note-free audit summary, and returns bounded history for the current site. A relocation note does not move the operator. |
| Observation cue | `PARTIAL` | `deriveSiteConditionCue` implements a deterministic, one-hour-fresh, observation-only cue. It is not a forecast, validated suitability score, or relocation command. |
| Authentication / authorization | `PARTIAL` | `OPERATOR` self scope plus `site-condition:view/create`; runtime adapter remains development fake and production session resolution fails closed. |
| Persistence | `PARTIAL` | `memoryStore.siteConditionObservations` and idempotency map persist to local `data/db.json`; a separate isolated file-backed development store survived a process restart in the runtime evidence. Drizzle catalogue table/index definitions exist without deployed migration or production persistence. |
| Retention | `PARTIAL` | R-28 working 90-day maximum and read/write-triggered local purge; no scheduled production job or backup expiry proof. |
| Analytics / audit | `IMPLEMENTED` | Pino logs `site_condition_viewed`, `site_observation_saved`, `site_observation_save_failed`, and cue-triggered `relocation_recommendation_viewed` with allowlisted properties; audit excludes free-text notes. No warehouse exists. |
| Tests | `PARTIAL` | Domain, adapter fallback, API authorization/scope, validation, persistence in the process, idempotency, and analytics-redaction tests exist; file-backed development process-restart proof is recorded. Browser acceptance evidence remains pending. |

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
| --- | --- | --- | --- | --- | --- |
| Current location / active shift | `getOperatorLocationContext` | shifts/location reports/selling locations | `GET /api/v1/operators/me/site-condition` | Operator self | `IMPLEMENTED`; response omits GPS |
| Weather source/current reading | `WeatherAdapter` port | None | same GET | Current site would be required | `UNSUPPORTED`; explicit unavailable state only |
| Recent traffic | Task 11 read model | traffic sample map | same GET, reusing `getTrafficSamplingPage` | Current site in session org | `PARTIAL`; optional and feature-gated |
| Recent sales | Existing self-scoped `listTransactions` plus internal persisted-sale location filter | sales/payments/shifts | same GET | Current operator + active shift + current site | `PARTIAL`; bounded recent query; no new location field exposed in the general transaction projection or sales-based cue |
| Wet/dry + shelter observation | `SiteConditionObservation` | `siteConditionObservations` map and `siteConditionObservationByClientId` map | `POST /api/v1/operators/me/site-condition` | Authenticated current active shift/site | `IMPLEMENTED` in local pilot |
| Shelter and relocation-decision notes | bounded optional observation fields | same file-backed row | same POST | Current active shift/site | `IMPLEMENTED`; note does not change location |
| Observation-only cue | `deriveSiteConditionCue` | latest site observation | same GET | Current site | `PARTIAL`; no external weather inputs |
