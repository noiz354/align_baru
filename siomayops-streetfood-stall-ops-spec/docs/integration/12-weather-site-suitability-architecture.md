# Page 12 — Weather & Site Suitability: architecture

## Implemented flow

```text
Operator page
  → GET/POST /api/v1/operators/me/site-condition
  → existing session resolver + site-condition:view/create authorization
  → getOperatorLocationContext(session.scope)
  → site-condition query/use case
      ├─ bounded same-location observation history
      ├─ optional Page 11 same-location manual traffic history (only while enabled)
      ├─ existing transaction read model, restricted to server-derived active shift
      ├─ weather adapter → explicit PROVIDER_NOT_CONFIGURED response
      └─ pure 60-minute observation-only cue rule
  → file-backed memoryStore maps + append-only audit summary
  → refreshed no-store read model in the UI
```

## Current reads and support boundaries

- **Location/shift:** reused `getOperatorLocationContext`; Page 12 projects only site name/status and shift business day/stall code. It never serializes the optional GPS fix or coordinates.
- **Weather:** `src/server/weather/weather-adapter.ts` is an explicit provider boundary. The configured implementation is intentionally unavailable and returns null measurements; it makes no outbound request and must not infer weather from GPS, notes, or traffic.
- **Traffic:** reuses `getTrafficSamplingPage`, strips notes/IDs, and labels rows as manual estimates. Page 11 is production-gated; its counts do not affect the Page 12 cue.
- **Sales:** reuses `listTransactions` with its existing server-side self scope, then internally checks only those authorized row IDs against the persisted sale's active-shift and `sellingLocationId` values. The general transaction projection is unchanged; the bounded recent amounts do not affect the cue.
- **Observations:** up to five newest records for the current organization/site are returned without actor IDs. A write requires an active operator shift and derives actor, shift, location, and organization from server context.
- **Cue rule:** no observation or an observation older than 60 minutes → `INSUFFICIENT_DATA`; fresh wet ground and unavailable shelter → `REVIEW_SHELTER`; other fresh wet ground → `WET_GROUND_CAUTION`; fresh dry ground → `NO_RELOCATION_CUE`. It is a transparent operational cue, not a score, forecast, safety certification, or move action.

## Write and persistence

`POST` accepts only a UUID request ID, `DRY|WET`, `AVAILABLE|NOT_AVAILABLE|UNKNOWN`, and bounded optional shelter/decision notes. The `Idempotency-Key` must match the body request ID. A mismatch/replay with a changed shift, site, or payload returns conflict. Notes are excluded from Pino events and audit summaries. The decision note does not call Page 10's location-report write path.

Pilot rows live in `memoryStore.siteConditionObservations` and the matching idempotency index; the file-backed adapter persists both to ignored `data/db.json` and revives ISO timestamps after restart. `src/server/db/schema.ts` has a corresponding Drizzle catalogue table and lookup/uniqueness indexes, but **no deployed SQL migration or production repository** exists. The 90-day pilot cleanup is invoked on Page 12 reads/writes; this is opportunistic, not a scheduled job or backup deletion proof.

## Authorization and observability

Only `OPERATOR` self sessions are admitted. `site-condition:view` and `site-condition:create` are separate server-side actions. The API has no caller-selected tenant, actor, shift, or location fields. Audit rows record the actor and structured ground/shelter values plus note-presence booleans, never note text. Pino uses the event allowlist in `docs/analytics/12-weather-site-suitability.md`.
