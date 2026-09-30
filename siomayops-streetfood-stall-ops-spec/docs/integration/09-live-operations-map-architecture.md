# Page 09 — Live Operations Map architecture

**Route:** `/operations/map`
**Ground truth:** `docs/integration/09-live-operations-map-ground-truth.md`
**Analytics:** `docs/analytics/09-live-operations-map.md`
**Prompt: `docs/product/end-to-end-pages/09-live-operations-map.md`

## Read and event flow

```text
OperationsMapPage
  ├─ GET /api/v1/operations/map?businessDay&areaId&cursor&limit
  │    ├─ resolveSession() → authorize(hq:view, organization target)
  │    ├─ operationsMapQuerySchema (strict date/area/cursor/page validation)
  │    ├─ getOperationsMap(session.scope, filters)
  │    │    ├─ getHqDashboard(...) reuses session-scope location resolution,
  │    │    │  one-day sales/operational aggregates, and cursor ordering
  │    │    ├─ join selected selling-point coordinates, explicit shift reports,
  │    │    │  and linked open incidents from memoryStore
  │    │    └─ project an allowlisted marker contract; omit operator/session IDs and notes
  │    └─ map_viewed / map_filter_changed / stale_location_seen logs
  ├─ POST /api/v1/operations/map/events
  │    ├─ resolveSession() → authorize(hq:view)
  │    ├─ accepts only map_marker_opened + coarse markerType
  │    └─ structured log; no business data or audit-row mutation
  └─ OpenStreetMap tile images (browser-only, visible attribution)
```

The API returns no-store JSON. The map never writes a location, shift, incident, or operator record. Marker selection only updates client selection state and sends an allowlisted telemetry event. There is no background location polling and no report-action link: the existing `/locations` page is not narrowed to area/self scope, while `/hq/incidents` is static fixture UI, so linking either from this scoped map would be unsafe or misleading. A production capture/report UI is a remaining integration gap.

## Map contract and semantics

The read model is `src/features/hq/operations-map.ts`; HTTP validation is in `src/shared/contracts/operations-map.ts`.

- An active shift's marker identifies its currently open explicit `LocationReport` location, following the same location-resolution behavior used by `getHqDashboard`; if no open report is present, it falls back to the shift's start location.
- Pin coordinates come from the persisted selling-point `lat`/`lng`, not from a device location fix. Out-of-range/non-finite/missing values become `coordinates: null` and `coordinateStatus: MISSING`; no coordinates are fabricated.
- A configured selling point without an active shift may still appear as a site marker, but its report freshness is `unknown`. Its stored coordinates are not described as a current stall position.
- Location freshness is based only on the active shift's latest explicit open location report or shift start: `<5 min` = current, `5–60 min` = recent, `>60 min` = stale; missing timestamp = unknown. These are report-age bands, not GPS accuracy or a promise of real-time presence.
- Daily completed-sales amount/count come from the existing HQ dashboard read model for the chosen Jakarta business day.
- Incident counts are included only when the persisted open incident is linked to a currently visible active shift. The map does not show descriptions, people involved, severity, or infer a location for unlinked/closed-shift incidents.
- `limit` defaults to 50, accepts 1–100, and uses the existing deterministic outlet cursor. Each page's coordinate/stale/incident subtotals are explicitly labeled as page-level in the UI.
- The server validates and scopes filters via the existing dashboard resolver. An area supervisor cannot request another area; foreign-tenant records never enter the marker contract.

## Data/persistence facts

| Concern | Source | Current behavior |
|---|---|---|
| Authoritative store | `memoryStore` | JSON file at `data/db.json`, or `SIOMAYOPS_DATA_FILE`; single-process pilot durability |
| Selling point | `sellingLocations` | Organization/area/name/status with optional numeric `lat`/`lng`; IDs and names are returned only for authorized points |
| Reported position | `locationReports` → `shifts` | Operator-initiated, shift-bounded location ID + `arrivedAt`; no coordinate track |
| Daily operating/sales snapshot | `getHqDashboard` | Existing completed-sale and outlet status aggregates; single business-day query |
| Open incident count | `incidents` → currently visible active shift | Count only; no free-text details or guessed coordinates |
| Weather / traffic | No authoritative runtime entity | Omitted as data and shown as explicitly unavailable |
| Map persistence | None | Read-only page; marker analytics go to the existing structured logger |

No database schema migration or new repository/table is introduced.

## UI/action source map

| UI field/action | Domain/persistence source | Server entrypoint | Scope/status |
|---|---|---|---|
| Area and business-day filters | Existing `getHqDashboard` + business-day logic | `GET /api/v1/operations/map` | Session-derived scope, validated server filters; implemented |
| Selling-point pins and coordinates | `sellingLocations.lat/lng`, explicit current shift report location | Map GET | Coordinates optional; missing/invalid values visibly omitted from map and retained in list |
| Operational status and shift presence | `OutletSummary` from HQ dashboard | Map GET | Organization/area/stall/self-visible locations; no operator identity in output |
| Sales amount/count | Completed `sales` aggregates from HQ dashboard | Map GET | Chosen business day and session scope |
| Linked open-incident count | `incidents` linked to visible active `shifts` | Map GET | Count-only, exact active-shift link; partial source coverage |
| Freshness band | `locationReports.arrivedAt` or `shifts.startedAt` | Map GET | Explicit report age only; not live GPS |
| Marker selection/detail | Returned map marker | Client state; telemetry POST | Read-only; no domain mutation; no link-through to the identity-bearing HQ outlet detail page |
| Stale location event | Page-level stale count | Map GET logger event | Count only; no outlet IDs/coordinates |
| Traffic / weather/site cards | No persisted source | None | Explicitly “Belum tersedia”; unsupported |

## External map tiles and privacy

The client loads standard raster tiles from `tile.openstreetmap.org` and renders the server-authorized marker layer over them, with visible `© OpenStreetMap contributors` attribution. No marker ID, operator/session identifier, incident note, or raw API payload is sent to the tile URL. As with any third-party tile service, the tile provider receives the browser request/network metadata and requested tile coordinates (which indicate a geographic tile); this dependency is disclosed in the UI/runtime documentation. The map does not request browser geolocation and does not persist/poll device coordinates.
