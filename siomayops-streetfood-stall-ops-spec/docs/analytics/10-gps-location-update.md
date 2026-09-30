# Page 10 — GPS / Current Location Update Analytics

**Status:** Defined for the Page 10 implementation. Uses the existing structured `logger`; no new SDK.

| Event | Trigger | Allowed properties | Prohibited properties | Downstream use |
| --- | --- | --- | --- | --- |
| `location_page_viewed` | Successful self-scoped Page 10 context read | `page=operator-location`, request correlation ID | Coordinates, accuracy, capture time, operator/shift/outlet IDs, permission token, free text | Aggregate page reach/reliability |
| `location_capture_started` | Operator taps “Ambil posisi sekali”, before the browser request | `page=operator-location`, request correlation ID | Coordinates, accuracy, capture time, operator/shift/outlet IDs, permission token, free text | Count explicit capture attempts and assess UX friction |
| `location_permission_denied` | Browser reports that permission was denied | `reason=denied`, page, request correlation ID | Coordinates, accuracy, capture time, identity/resource IDs, browser error text | Identify permission-related friction; never an operator score |
| `location_saved` | Server successfully persists a location report | `gpsSampleIncluded` boolean, page, request correlation ID | Coordinates, accuracy, capture time, operator/shift/outlet/report IDs, report note | Aggregate completion and optional-sample adoption |
| `location_save_failed` | Server rejects/fails a report, or the client observes a network failure | allowlisted coarse `reason` (`validation`, `forbidden`, `conflict`, `server`, `network`), page, request correlation ID | Coordinates, accuracy, capture time, identities, resource IDs, raw error/body text | Diagnose flow reliability and failure categories |

The server event helper constructs an allowlisted object and never accepts arbitrary client properties. Client telemetry accepts only the event enum and coarse reason enum. No event contains a selling point, outlet, organization, operator, shift, or location report identifier. The raw GPS sample is not sent to analytics, logs, traces, or HQ map/read models.

## Implementation reference

- `src/features/locations/analytics.ts`
- `POST /api/v1/operators/me/location/events` accepts the client-side capture-started, permission-denied, and network-failure events under operator self scope.
- Successful/failed report events are emitted from the server-side location-report use case boundary.

Analytics is for product reliability only. It must not be joined to operator performance, attendance, discipline, or movement analysis (ADR-0039, NFR-PRIVACY-011).
