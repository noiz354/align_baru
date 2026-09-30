# Page 10 — GPS / Current Location Update architecture

**Date:** 2026-09-30
**Status:** Implemented against the existing file-backed pilot adapter; production gates remain open.

## Request/read flow

```text
/operator/location
  ├─ GET /api/v1/operators/me/location
  │    ├─ resolveSession + authorize(location:view, self)
  │    └─ getOperatorLocationContext(session.scope)
  │         ├─ purge expired GPS fields opportunistically
  │         ├─ select only this operator's OPEN/PENDING_SYNC shift
  │         ├─ derive stall, area, current report and location choices server-side
  │         └─ return raw GPS only for this operator's current open report
  └─ Browser permission state (Permissions API; no sample captured on page load)
```

## One-shot/write flow

```text
Operator taps “Ambil posisi sekali”
  → requestOneShotPosition() calls getCurrentPosition once (maximumAge: 0)
  → coordinates, accuracy, timestamp remain in page memory until explicit submit
  → operator reviews the point and separately checks the attachment confirmation
  → POST /api/v1/shifts/{shiftId}/location-reports
       Idempotency-Key == clientReportId
       { sellingLocationId, trigger, reasonForMove?, gpsSample? }
  → authorize(location:report, session self)
  → strict contract + coordinate/range/freshness validation
  → reportLocation verifies org, operator/shift ownership, shift state, stall area and selling point
  → persist sample on existing LocationReport; audit summary and telemetry omit raw fields
  → GET self context refreshes the current read model
```

The report body has no organization, operator, stall, or outlet identity fields. Those values are resolved from the authenticated session and stored shift. Manual selling-point reporting remains usable if location permission is denied, unsupported, or times out. The browser sample is not placed in localStorage, cookies, service-worker state, or the offline outbox. If a request fails, the page keeps it only in volatile component state until the page closes/reloads or the user retries.

## Data and scope

- Reuses `StoredLocationReport`; does not create a separate GPS entity/repository.
- Optional `gpsSample` fields: `latitude`, `longitude`, `accuracyMeters`, `capturedAt`.
- Current authoritative pilot persistence: `memoryStore.locationReports` serialized to the configured JSON data file with existing atomic-rename persistence.
- Drizzle schema adds nullable latitude/longitude/accuracy/capture-time columns and a capture-time index; no production migration or SQL repository is included in this checkout.
- GPS fields are available only in the authenticated operator's self-scoped current-location response. HQ map/coverage projections remain selling-point-only. Audit summaries and Page 10 analytics never include coordinates, accuracy, capture time, report IDs, or operator IDs.
- Each submitted report can carry at most one fix; confirming the same open selling point updates that report's fix instead of creating a duplicate. Moving to a different selling point creates a new report; several explicit submissions can therefore form a sparse, shift-bounded sequence during the 14-day window.

## Validation and failure behavior

- Latitude/longitude must be finite and in range; accuracy must be finite, non-negative, and at most 100 km.
- Client capture time must be valid, no more than five minutes old, and no more than two minutes in the future relative to server time. The capture timestamp remains device-reported and is not proof of device integrity.
- Only `OPEN` and `PENDING_SYNC` shifts are accepted. `MOVE_SITE` requires a controlled reason. `INACTIVE` selling points and points outside the active stall's area are rejected.
- Idempotency header must match `clientReportId`; replays are further constrained to the same organization, operator, and shift.
- Expected errors map to 400/403/404/409/412. The page preserves manual reporting after GPS failures and does not claim a failed network write was saved.

## Retention, deployment, and production gates

`purgeExpiredGpsSamples()` removes only GPS fields whose capture time is at least 14 days old or invalid, retaining the operational report. It runs during process initialization and Page 10 read/write entrypoints. This is an opportunistic pilot-adapter safeguard, not a reliable scheduled-retention guarantee. The page/read model disables browser capture in production by default, and the write use case rejects GPS samples unless `GPS_LOCATION_SAMPLES_ENABLED=true`. Do not set that flag until all of the following are approved and evidenced:

1. privacy-owner/DPO review of the preliminary DPIA and point-of-collection notice;
2. production SQL migration/repository and a reliable scheduled purge running at least daily;
3. deletion verification for replicas/backups and monitoring/alerting for purge failures;
4. real production authentication/session adapter and authorization integration tests.

No background geolocation, `watchPosition`, timer/polling capture, third-party location SDK, location-based attendance, or performance scoring is introduced (ADR-0039, NFR-PRIVACY-011).
