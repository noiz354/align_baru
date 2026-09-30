# Page 09 — Live Operations Map gap report

**Date:** 2026-09-30 (Asia/Jakarta)
**Route:** `/operations/map`
**Ground truth:** `docs/integration/09-live-operations-map-ground-truth.md`
**Architecture:** `docs/integration/09-live-operations-map-architecture.md`

## Implemented and tested locally

- Server-authorized, area-filtered and cursor-paged map data reuses `getHqDashboard` scope resolution and its existing business-day sales/operational status model.
- Map marker projection validates optional selling-point coordinates and returns an explicit missing-coordinate state instead of substituting example pins.
- The map uses only shift-bounded explicit location reports (or the explicit shift start location) to associate an active selling point; age bands are labelled as report age, never GPS accuracy.
- The JSON contract omits operator IDs/names, phone numbers, incident descriptions, notes, active shift IDs, and identity-based analytics properties. The marker panel deliberately does not link to the existing identity-bearing HQ outlet-detail page. Open incident counts are only attached to visible active shifts.
- The map is read-only. No existing scope-safe capture/report UI was found: the generic `/locations` page is not area/self narrowed and `/hq/incidents` is static fixture UI. Neither is linked. Add proper scoped location/incident capture links when those flows have real UI support.
- Area/business-day validation, unknown cursor rejection, unauthenticated and role denial, area/tenant isolation, coordinate bounds/serialization, stale reports, count-only incidents, empty states, pagination, and analytics allowlisting have tests.
- OSM tiles have visible attribution and a tile-failure fallback that preserves the accessible location list. Tile fetches are a browser-only third-party dependency.

## Capabilities explicitly unavailable at baseline

| Capability | Gap | UI behavior |
|---|---|---|
| Exact current operator/device position | No GPS history or continuous tracking is stored or allowed by ADR-0007 | No browser geolocation or “live person” marker; active position is only the latest explicit selling-point report |
| Selling point coordinates | `lat`/`lng` are optional and not consistently entered by current location workflows | Pin omitted for missing/invalid values; table says coordinates are not available |
| Traffic sampling | No persisted traffic sample or estimator; future Task 11 is not implemented | Explicit “Belum tersedia”; no synthetic count/band |
| Weather/site observation | No weather provider or persisted observation model; future Task 12 is not implemented | Explicit “Belum tersedia”; location status is not presented as weather |
| Incident coverage | Unlinked incidents and incidents from closed shifts cannot be assigned to a current map marker from source facts | Only open incidents linked to the current visible active shift are counted; no text/severity exposed |
| Production identity assurance | Development provider is fake and production fails closed | Automated route tests prove permission/scope policy, not production authentication |
| Tile service availability | Browser needs access to OpenStreetMap's public tile server | Show a tile error notice and keep the scoped table available |
| Large map sets | Each request returns at most 100 markers; user follows a cursor for subsequent points | Current-page aggregates are labelled as page-level |

## Acceptance evidence still outstanding

- No Chromium/Playwright browser executable is available in this environment. Browser interaction, visual/map positioning, mobile review, external tile loading, browser console, and keyboard marker behavior still require manual/browser verification.
- Runtime evidence uses isolated synthetic file-backed records, not production or customer locations.
- Remote CI was not triggered. Local commands and the existing application CI job are reported in `09-live-operations-map-runtime-evidence.md`.
- This work does not mark Task 8 or the earlier Page 7 browser acceptance complete.
