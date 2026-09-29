# Dashboard Analytics Events — 01-dashboard

## Event catalog

### `dashboard_viewed`
- **Trigger:** Server-side, on every successful dashboard page load.
- **Properties:**
  | Property | Type | Description |
  |---|---|---|
  | `businessDay` | string | YYYY-MM-DD business day being viewed |
  | `outletCount` | number | Number of outlets in the response |
  | `activeOutlets` | number | Number of currently operating outlets |
  | `alertCount` | number | Number of active alerts |
  | `salesMinor` | number | Total sales in minor units (integer) |
- **Prohibited properties:** passwords, tokens, phone numbers, raw media, free-text notes
- **Downstream use:** Daily active dashboard usage, outlet activity patterns

### `dashboard_filter_changed`
- **Trigger:** Client-side, when the user changes a filter (search, outlet scope, date).
- **Properties:**
  | Property | Type | Description |
  |---|---|---|
  | `filterKind` | string | Type of filter (e.g., "search", "outlet", "date") |
  | `filterValue` | string | Truncated filter value (max 50 chars) |
- **Prohibited properties:** full search text (truncated), PII
- **Downstream use:** Search usage frequency, popular filter terms

### `dashboard_outlet_opened`
- **Trigger:** Client-side, when the user clicks an outlet row to drill down.
- **Properties:**
  | Property | Type | Description |
  |---|---|---|
  | `outletId` | string | Stable outlet identifier |
  | `outletName` | string | Outlet display name |
  | `outletStatus` | string | Current status enum value |
- **Prohibited properties:** operator names, location coordinates
- **Downstream use:** Most-viewed outlets, status-based navigation patterns

### `dashboard_error_shown`
- **Trigger:** Server-side, when the dashboard fails to load data.
- **Properties:**
  | Property | Type | Description |
  |---|---|---|
  | `errorKind` | string | Error classification (e.g., "load_failure") |
  | `errorMessage` | string | Truncated error message (max 120 chars) |
- **Prohibited properties:** stack traces, auth tokens, full error payloads
- **Downstream use:** Error rate monitoring, reliability metrics

## Implementation

- **Server-side events:** `emitAnalytics()` in `src/server/telemetry/analytics.ts` → structured pino log
- **Client-side events:** `emitClientAnalytics()` → POST `/api/v1/analytics` → same server pipeline
- **Storage:** Structured log entries (pino JSON). No separate analytics database in this slice.
- **Privacy:** All events are sanitized — prohibited properties (secrets, PII, media) are stripped before emission.
