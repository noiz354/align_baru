# Page 10 — GPS / Current Location Update ground-truth audit

**Date:** 2026-09-30 (Asia/Jakarta)
**Canonical prompt:** `docs/product/end-to-end-pages/10-gps-location-update.md`
**Route:** `/operator/location`
**Audit phase:** pre-code baseline completed before Page 10 implementation. The current implementation status is recorded in the final section below.

## Existing behavior and capability classification (pre-code baseline)

| Capability | Status at audit time | Evidence / notes |
|---|---|---|
| `/operator/location` page | `MISSING` | No route existed. `/operator` was a profile page; `/shift` was a separate page and contained hardcoded shift/location context. Its “Lapor Lokasi Mangkal” control navigated to `/sell`, not a location flow. |
| One-shot browser location capture | `UNSUPPORTED` (at audit time) | No `navigator.geolocation` call existed. `next.config.mjs` sent `Permissions-Policy: geolocation=()` globally. `tools/check-stubs.mjs` rejected `navigator.geolocation` (and `watchPosition`) anywhere under `src/`. |
| Optional one-shot position assist | `PARTIAL` (specification only) | `LOCATIONS.md` §4 and ADR-0007 allowed an operator-initiated one-shot fix to help confirm a selling point, but differed from the canonical prompt's persisted accuracy/sample request. |
| GPS sample contract | `MISSING` | `src/shared/contracts/locations.ts` had only an unused proposed-pin schema containing bounded latitude/longitude; no accuracy or GPS-fix timestamp. |
| Persisted GPS sample / accuracy | `MISSING` | `StoredLocationReport` and the Drizzle `locationReports` table had no latitude, longitude, accuracy, or GPS capture-time fields. |
| Current shift / session read | `PARTIAL` | `GET /api/v1/shifts` restricted rows by session scope but returned raw shift records rather than a Page 10 projection. `getCurrentLocationForShift()` existed without a Page 10 caller or session scope. |
| Last reported selling point | `PARTIAL` | `locationReports` and `getCurrentLocationForShift()` could resolve an open report to `sellingLocations`, but no Page 10 read endpoint existed. This was a selling-point report, not a GPS position. |
| Location picker/list | `PARTIAL` | `GET /api/v1/locations` filtered by organization after authorization, not by the operator's assigned area. It was not safe to reuse as the Page 10 picker. |
| Location-report write | `PARTIAL` | The existing `POST /api/v1/shifts/{shiftId}/location-reports` did not call `authorize()` or prove that the path shift belonged to the authenticated operator. `reportLocation()` also did not compare the shift owner to the session actor. This was an IDOR/authorization gap. |
| Server time and persistence | `PARTIAL` | `reportLocation()` set `arrivedAt` from server time and persisted through `memoryStore`; the pilot store is JSON-file-backed with atomic rename/restart durability. |
| Accuracy and permission state UX | `MISSING` | No permission-state read, accuracy display, GPS failure state, or capture UX existed; geolocation was globally disabled by response policy. |
| Page 10 analytics | `MISSING` | No capture/save event existed. Pino structured logging was the existing telemetry abstraction. |
| Page 10 tests | `MISSING` | No focused location report unit/API/browser tests covered the flow or the report route authorization. |
| Production identity provider | `UNSUPPORTED` in this checkout | `src/server/auth/port.ts` used fake sessions in development and returned `null` in production. |

## Existing data and entrypoint map (pre-code baseline)

| UI field/action | Current source | Persistence source | Existing server entrypoint | Baseline scope/status |
|---|---|---|---|---|
| Current operator | `SessionContext.operatorId` | Auth session / operator registry | `resolveSession()` | Fake development actor only; production auth adapter absent |
| Active shift context | `StoredShift` | `shifts` | `GET /api/v1/shifts` | Scope-filtered list, not projected for this page |
| Last selling-point report | `getCurrentLocationForShift()` | `locationReports` → `sellingLocations` | No page-specific GET | Feature helper was not session-scope-aware |
| GPS permission/fix | None | None | None | Browser geolocation was unavailable under the then-current policy/checker |
| Proposed coordinates | `proposedPinSchema` only | None | None | Validation shape only; not persisted or used |
| Accuracy/capture time | None | None | None | Unsupported by stored entity/DB schema |
| Explicit report submission | `reportLocation()` | `locationReports`, audit log, idempotency store | Existing POST route | Existing handler lacked action/shift-owner authorization |
| Capture/save analytics | Pino logger exists | Structured logs | No Page 10 event endpoint | Missing |

## Pre-code privacy/security conflict and resolution

Page 10's canonical prompt requested a GPS sample, accuracy, timestamp, and actor/outlet context to be persisted. The user explicitly approved one optional, user-triggered sample attached to each explicit active-shift report, with no background/watch tracking. ADR-0039 records that decision, sets a 14-day maximum raw-field retention, and keeps production capture gated on privacy-owner/DPO review and an operationally verified purge/backup-expiry process. Sparse points from multiple explicit reports are disclosed as such; they are excluded from HQ maps, analytics, attendance, discipline, and performance scoring.

## Pre-code conclusion and decision

At the time of the baseline, the page, current-location read model, safe location-choice query, persisted sample, and page analytics were missing, and the report writer lacked self-scope authorization. ADR-0039 and the related privacy/security/data/API documents were reconciled before feature implementation. Current code and verification status follow. Production use remains blocked on privacy-owner/DPO approval and reliable production retention execution. T-LOC-004 remains open.

## Current implementation and verification status (2026-09-30)

| Capability | Current status | Evidence / remaining limit |
|---|---|---|
| `/operator/location` page | `IMPLEMENTED` | `src/app/operator/location/page.tsx`; live self-scoped data, empty/error states, selling-point picker, move reason, optional sample review/confirmation, and report refresh. |
| One-shot capture and permission UX | `IMPLEMENTED` | `src/app/operator/location/geolocation.ts` contains one `getCurrentPosition` call, only invoked by the foreground button; no watch/timer/background capture. Capture uses `maximumAge: 0`, high accuracy request, and bounded timeout. |
| Self-scoped context/picker | `IMPLEMENTED` | `GET /api/v1/operators/me/location` uses `authorize(..., "location:view", self)` and a deterministic read model; choices are restricted to the active stall's area and organization. Raw sample fields are returned only to the owner for their open report. |
| Write authorization / IDOR correction | `IMPLEMENTED` | `POST /api/v1/shifts/{shiftId}/location-reports` authorizes `location:report`; use case checks session operator, tenant, shift state, stall/area, and location organization. The body cannot supply an actor. |
| GPS contract and persistence | `IMPLEMENTED` in the current adapter | Strict request contract validates ranges and server-time freshness. Coordinates, device accuracy, and capture time are stored on the existing `LocationReport`; same-point explicit confirmation updates the active report's single sample rather than making a duplicate report. File-backed JSON is the running authoritative store. |
| SQL schema/migration | `PARTIAL` | Drizzle schema describes four nullable GPS fields and a capture-time index. This checkout has no production migration applied or SQL-backed repository for this feature. |
| 14-day retention | `PARTIAL` | Expired GPS fields are scrubbed at process startup and Page 10 read/write entrypoints while the selling-point report remains. A reliable scheduled production purge, backup-expiry verification, and operational evidence are still absent; this is a production gate, not a completed guarantee. |
| Analytics and audit | `IMPLEMENTED` | Existing Pino logger emits enum-only capture/permission/save events. Audit summaries contain no coordinates/accuracy. No IDs, raw coordinates, timestamps, or free text enter Page 10 telemetry. |
| Unit/API tests | `IMPLEMENTED` for focused slice | `tests/unit/location-gps.test.ts` and `tests/integration/location-api.test.ts`: 13 tests pass, including stale/invalid sample, own/cross-operator/tenant access, area-bounded picker, raw-data redaction, idempotency, production capture gate, and retention scrub. |
| Typecheck | `PASS` | `corepack pnpm typecheck --pretty false`. |
| Browser/E2E and runtime durability | `UNKNOWN` / not yet run | Browser geolocation permission simulation, actual rendered user journey, direct persisted-state inspection after reload/restart, and console/server-log inspection are still required before acceptance. |
| Production authentication | `UNSUPPORTED` in this checkout | Fake development session supports local tests; `AuthPort` returns no session in production. |

Known repository check result: `corepack pnpm census` still fails on the existing orphan `NFR-SEC-021` references in `IMPLEMENTATION_STATUS.md` and `docs/integration/05-transactions-runtime-evidence.md`; it reports 131/131 P0 requirements covered, 39 ADR records, and zero `NotImplemented` stubs. This unrelated baseline failure is not evidence that Page 10 is complete.
