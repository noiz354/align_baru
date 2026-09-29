# Dashboard / Operasional Hari Ini — Architecture

## Contract-first boundary

```text
src/shared/contracts/dashboard.ts
  ├─ dashboardReadModelSchema
  ├─ dashboardResponseSchema
  └─ DashboardReadModel / DashboardFilterInput types
        ↓ same shape
Browser page (`src/app/page.tsx`)
        ↓ relative fetch, no localhost dependency
GET `/api/v1/hq/dashboard`
        ↓
resolveSession → authorize("hq:view") → parse filters
        ↓
getHqDashboard({ session.scope, businessDay, filters })
        ↓
scoped read-model calculations over `memoryStore`
        ↓
data/db.json file-backed pilot persistence
```

The route validates the response with `dashboardResponseSchema` before returning it. The client validates the received JSON with the same schema before rendering it. Amounts remain integer IDR minor units and timestamps remain ISO instants until presentation.

## Read model responsibilities

`getHqDashboard` owns:

- business-day filtering and Jakarta-time trend bucketing;
- organization, area, stall, self, and selected-outlet visibility;
- completed-sale totals, payment-method separation, expense totals, outlet status, alerts, activity, and cursor pagination;
- source watermark and generated timestamp.

The React component owns only presentation, browser state, navigation, and formatting. It does not scan persistence, calculate totals, or manufacture operational rows.

## Error and state flow

- `401` → authenticated-access error state.
- `403` → authorization error state.
- `400` → filter validation error returned by the boundary.
- `404` → selected outlet is not visible or does not exist.
- `500` / contract failure / network failure → retryable error state; if an older read exists, the page keeps it and labels the refresh failure.
- valid empty data → empty dashboard/table/alert/activity states, with no fallback sample records.

## Query parameters

| Parameter | Meaning | Server authority |
|---|---|---|
| `date` | Requested business day (`YYYY-MM-DD`) | Format/calendar validated; default is server-derived Jakarta business day |
| `outletId` | Optional visible outlet | Rechecked against session scope |
| `areaId` | Optional area narrowing | Area supervisors cannot request another area |
| `search` | Outlet/operator/status search | Applied in read model before pagination |
| `status` | Outlet status union | Zod enum |
| `cursor`, `limit` | Bounded table pagination | Limit 1–100 |

## Persistence boundary

This slice intentionally reuses the existing file-backed pilot adapter rather than introducing a second repository or a schema migration. `memoryStore` loads `data/db.json`, wraps map writes with atomic persistence, and seeds development records when needed. This is useful for local runtime evidence, but the file adapter is explicitly marked as a mock-only temporary server adapter and is not a claim of PostgreSQL production readiness.

## Analytics and observability

The page sends stable event properties to `/api/v1/analytics`. The endpoint derives organization and actor from the session, validates the event contract, and writes structured logs. It does not accept free-text notes, secrets, media, or client organization claims. The endpoint is marked `MOCK ONLY` because no real telemetry provider is connected yet. Dashboard read latency and contract/read failures are recorded through the existing metrics abstraction.
