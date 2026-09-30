# ADR-0039: Persisted one-shot GPS assist for explicit shift location reports

- **Status:** Accepted data
- **Date:** 2026-09-30
- **Slice:** Page 10 / T-LOC-004
- **Area:** Privacy/Location
- **Supersedes:** ADR-0007 only for the optional one-shot sample persistence described below
- **Superseded by:** —
- **Related:** ADR-0007, ADR-0013, ADR-0016, ADR-0037, `LOCATIONS.md`, `PRIVACY.md`, `RETENTION.md`

## Context

The Page 10 prompt requires the operator's current location sample, accuracy, capture timestamp, and shift/outlet context to be persisted. ADR-0007 allowed a one-shot fix only as a proposed coordinate that was not stored as a GPS trail. Completely omitting persistence would not meet the approved Page 10 scope; continuous/background collection remains unnecessary and prohibited.

## Decision

1. A GPS fix may be requested only after the operator taps a foreground **Ambil posisi sekali** control on `/operator/location`. Use `getCurrentPosition` once for that action; never use `watchPosition`, a timer, automatic page-load capture, or background/polling capture.
2. A fix is optional and advisory. The operator sees its coordinates, reported accuracy, and capture time, chooses/confirms the selling point, then explicitly submits the location report. Manual selection/reporting remains available when permission is denied, the browser lacks geolocation, or the fix is unavailable. GPS is not proof that a person or stall is at a place and does not override the selected selling-point ID.
3. At most one fix may be attached to each submitted `LocationReport`. Persist latitude, longitude, device-reported accuracy in metres, and device capture timestamp as one structured sample. It is shift-bound and linked to the report's server-derived organization/operator/stall/shift context. The server's `arrivedAt` remains authoritative for the report; device capture time is untrusted metadata and must be recent and validated.
4. Raw sample values are visible to the submitting operator through the own-shift flow only. They are not returned by HQ map/dashboard/location-list APIs, external tile URLs, audit summaries, or analytics. Analytics may record event/status and generated request IDs, never coordinates, accuracy, location IDs, shift IDs, or operator IDs.
5. Raw GPS fields are purged no later than **14 days after capture** (R-25). The associated explicit selling-point report can remain under existing R-09 retention with GPS fields removed. The pilot file-store must scrub expired fields on startup and Page 10 read/write; a production deployment requires a reliable scheduled retention job and verified purge before enabling production capture. The application defaults production capture off and rejects GPS samples unless `GPS_LOCATION_SAMPLES_ENABLED=true`; do not set the flag before all review gates pass.
6. A data subject notice explains the one-shot collection, its purpose, 14-day raw-sample retention, and manual alternative before first capture. This is not described as employment consent. A DPIA is required; the preliminary Page 10 DPIA remains pending privacy-owner/DPO review. Do not enable production processing before that review.
7. Only a session operator may read or submit their own active shift report. The server derives actor, organization, shift, and stall; it must check shift ownership and active state before any duplicate lookup or write. Client-provided actor/scope IDs are never accepted.

## Consequences

- A few explicit, operator-triggered samples during a shift can exist as a bounded work-location history for up to 14 days. This is more sensitive than the selling-point ID report alone; it is not a continuous tracking stream.
- Permission can be denied or unsupported without blocking a manual report. Coordinates and accuracy are device-reported and spoofable; operators and HQ must not use them for attendance, discipline, or performance scoring.
- The browser document policy and the static geolocation checker must permit only the named one-shot helper/page; `watchPosition` and capture outside that helper stay forbidden.
- The current pilot adapter is file-backed and production auth/retention infrastructure is not complete. Runtime fixtures can demonstrate application behavior, not production compliance or identity integration.

## Alternatives considered

- Keep coordinates client-only and persist only the selected selling-point report (privacy-friendlier but does not satisfy Page 10's persisted accuracy/sample requirement).
- Persist continuous or periodic device coordinates (rejected; surveillance and unnecessary).
- Treat device GPS as authoritative or automatic geofencing (rejected; spoofable and outside the product's purpose).

## Review gates

Before production: complete and approve the DPIA; verify notice and manual fallback with operators; implement/verify the 14-day retention job and backup expiry; verify route-scoped browser permission and authorization in production; confirm data-subject access/deletion handling; review residual risk with the privacy owner/DPO.
