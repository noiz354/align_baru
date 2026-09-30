# Page 09 — Live Operations Map ground-truth audit

**Date:** 2026-09-30 (Asia/Jakarta)
**Canonical prompt:** `docs/product/end-to-end-pages/09-live-operations-map.md`
**Route:** `/operations/map`
**Audit phase:** completed before page-09 implementation; this file records the pre-code baseline and is not a post-implementation status report. Task 8 browser acceptance remains unverified and is not marked complete.

## Existing behavior found

| Capability | Status | Evidence / notes |
|---|---|---|
| `/operations/map` UI and map API | `MISSING` | No `src/app/operations` route, map-specific handler, map library, or tile-provider integration exists. `/hq` is a separate dashboard, not a map. |
| Selling-point coordinates | `PARTIAL` | `StoredSellingLocation` has optional `lat`/`lng`; the schema also has optional text coordinate fields. Current location creation/read-model contract does not consistently manage/expose validated coordinates; the development seed has one coordinate. Coordinates describe a configured selling point, not a device/GPS fix. |
| Latest reported selling point | `PARTIAL` | Persisted `locationReports` have a shift, selling-location ID, explicit `arrivedAt` and optional `departedAt`. `getHqDashboard` derives the current outlet from the latest open report, falling back to shift `startLocationId`. Reports contain no latitude/longitude and are operator-initiated, not continuous tracking. |
| Current area/outlet operational state | `PARTIAL` | `getHqDashboard` derives per-location `OPERATING`, `ATTENTION`, `REVIEW`, `NOT_STARTED`, or `CLOSED` using shifts, alerts and expenses. `SellingLocation.status` also stores operational states. It is not a geofence or live device location. |
| Sales snapshot | `PARTIAL` | `getHqDashboard` returns completed sales and transaction totals for one Jakarta business day, with payment splits and outlet rows; no map-specific snapshot contract exists. |
| Freshness of location | `PARTIAL` | Location report `arrivedAt`, shift `startedAt`, and source timestamps exist. No map freshness contract or explicit position-refresh interval exists. Freshness can describe age of the last explicit report only, not current GPS accuracy. |
| Operator/session identity | `PARTIAL` | Shifts link to operator IDs; the HQ dashboard can return operator name/ID. The map specification and ADR-0007 prohibit continuous individual tracking. Do not expose names, contact details, operator IDs, or a movement trail on map markers. The visible signal should be shift/stall-level only. |
| Traffic sample/summary | `MISSING` | No traffic sample entity, persistence map, read model, API, or traffic provider was found. The planned Task 11 capture page is not implemented. A performance helper contains only a placeholder traffic factor, not evidence. |
| Weather/site-condition summary | `MISSING` | No weather observation entity/provider or weather read endpoint exists. Stored location status can indicate operational states such as `CROWDED`/`TEMPORARILY_UNAVAILABLE`, but does not constitute a weather observation. The planned Task 12 page is not implemented. |
| Open incidents | `PARTIAL` | Incidents persist category/status/timestamps and optional shift linkage. Current `StoredIncident` has no typed severity/location coordinate, and the incident route/legacy HQ count endpoint is not a map-scoped read contract. Shift-linked incident counts can be derived without exposing free-text descriptions. |
| Session scope | `PARTIAL` | `GET /api/v1/hq/dashboard` uses `session.scope` and a visible-location resolver. Legacy `GET /api/v1/hq/locations` filters only by organization after HQ authorization; `GET /api/v1/locations` also lists by organization and is not an area/stall/self map-scope resolver. Neither should be reused as the map's authorization boundary. |
| Analytics | `MISSING` | No `map_viewed`, `map_marker_opened`, `map_filter_changed`, or `stale_location_seen` events exist. The existing Pino logger is the telemetry abstraction. |
| Map-specific tests | `MISSING` | Existing `tests/unit/hq-dashboard.test.ts` covers dashboard aggregates and area/tenant scoping, not map geometry/serialization/freshness. `tests/e2e/hq-coverage.spec.ts` uses local object fixtures and does not visit the app. No map browser test exists. |
| Persistence | `IMPLEMENTED` (pilot adapter only) | Runtime reads `memoryStore`, file-backed at `data/db.json` unless `SIOMAYOPS_DATA_FILE` is supplied. The active runtime is not PostgreSQL and is single-process. |

## Existing source and entrypoint map

| Map field/action | Existing domain/read source | Persistence source | Existing entrypoint | Baseline limitation |
|---|---|---|---|---|
| Selling-point pin coordinates | `SellingLocation.lat/lng` fields on runtime type | `sellingLocations` | No map endpoint; generic location list omits a dedicated map contract | Optional/static pin only; no GPS history or freshness timestamp |
| Latest reported location | `outletLocationForShift` in `src/features/hq/dashboard.ts` | `locationReports` joined to `shifts` | `GET /api/v1/hq/dashboard` | Dashboard outlet rows are paged and include operator-identifying fields; no map projection |
| Business-day sales | `getHqDashboard` | `sales`, `payments`, `shifts` | `GET /api/v1/hq/dashboard` | Single-day dashboard source, not a map API |
| Location operational status | `SellingLocation.status`, dashboard outlet status | `sellingLocations`, `shifts`, expenses, alerts/incidents | Dashboard GET; `GET /api/v1/hq/locations` counts only | No location status-reason/expiry fields in persisted record contract |
| Open incident count | Incident status source and dashboard incident alerts | `incidents`, optional `shifts` | `GET /api/v1/incidents` (write-only route in this checkout) and `GET /api/v1/hq/incidents` | Legacy endpoint is organization-wide; incident record has no typed severity or direct coordinate |
| Traffic estimate | None | No traffic sample store | None | Unsupported in this slice; do not fabricate |
| Weather/site observation | None; operational location status is not weather | No weather/site observation store | None | Unsupported in this slice; do not fabricate |
| Open a marker | No map selection flow | None | None | New page interaction only; must not mutate protected records |
| Navigate to specialized capture/report | Existing page URLs only where supported | Source records remain in their owning workflows | Location, incident, and planned future workflows | Link only to implemented flows; do not imply unsupported capture exists |

## Privacy and scope boundaries

- `docs/adr/ADR-0007-explicit-location-reporting.md`, `LOCATIONS.md`, `docs/locations/COVERAGE.md`, and `docs/product/HQ-DASHBOARD.md` require shift-bounded, operator-initiated location reports and explicitly reject continuous GPS, per-person “last seen,” movement trails, and productivity-by-location surveillance.
- A map marker may represent a **selling point** with an explicit shift report, not a person/device position. A last report timestamp is a report-age indicator, not a live-location guarantee.
- New server reads must derive tenant/area/stall/self scope from `resolveSession()` and the existing HQ dashboard resolver (or a shared extracted resolver); query filters are narrowing selectors, never authorization.
- Avoid passing `operatorName`, `operatorId`, phone, incident description/notes, or raw coordinates into analytics. For marker telemetry use only event/page IDs and coarse, non-identifying marker categories/counts.
- No map write is required by the canonical prompt. Marker selection and navigation are read-only actions.

## Data and implementation boundary

Use supported selling-point pins, shift-bounded location reports, dashboard-derived daily sales/operational status, and count-only linked open incidents where the persisted records support them. Missing coordinates should yield an explicit “pin unavailable” state, not invented coordinates. Traffic and weather/site signals have no backing facts at baseline and must be omitted or visibly labelled unavailable. Do not add a GPS tracking loop, weather provider, traffic inference model, new database table, or browser geolocation collection to make the map appear live.
