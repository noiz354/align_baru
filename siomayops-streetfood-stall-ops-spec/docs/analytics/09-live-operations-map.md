# Page 09 — Live Operations Map analytics

**Route:** `/operations/map`
**Implementation:** `src/features/hq/operations-map-analytics.ts`
**Ground truth:** `docs/integration/09-live-operations-map-ground-truth.md`

The page uses a small allowlisted structured-log projection. It is not an analytics database, audit event, or domain write. The event endpoint requires `hq:view`, accepts only the schema below, and logs no client-supplied identifier or arbitrary property.

| Event | Trigger | Allowed properties |
|---|---|---|
| `map_viewed` | Successful map-data response | request ID; fixed page name; present filter names from `businessDay`, `area` |
| `map_filter_changed` | Successful response with a query filter | Same allowlisted filter names; no filter values |
| `stale_location_seen` | Successful response contains stale reports | Aggregate stale-marker count for the current page |
| `map_marker_opened` | User opens a marker's detail panel | Coarse `active_shift` / `configured_site` marker type only |

The marker event contract contains neither marker/outlet ID nor coordinates. Filter values (including dates, area IDs, and cursor IDs), names, operator or session identity, sales totals, incident details, and free text are not logged. API request logs may include a server-generated request ID for tracing; it is not an operator or domain entity identifier.

Downstream use is limited to structured-log troubleshooting and coarse aggregate page/filter usage or stale-report prevalence; the repository does not currently persist these events to an analytics warehouse or dashboard. These projections cannot establish user identity, per-outlet behavior, live movement, device location, weather/traffic exposure, or business outcomes. Analytics names do not indicate a claim of those unsupported capabilities.
