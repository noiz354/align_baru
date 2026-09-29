# Dashboard / Operasional Hari Ini — Ground Truth

**Measured:** 2026-09-29 UTC
**Route:** `/`
**Page status:** `PARTIALLY_INTEGRATED`

`PARTIALLY_INTEGRATED` is intentional. The dashboard read path now uses a shared contract, an authenticated server boundary, the existing HQ read model, and the repository's file-backed pilot store. It is not `VERIFIED`: development authentication is still a fake adapter, the store is not the production PostgreSQL adapter, browser evidence is blocked by the unavailable Chromium binary, and analytics is currently a structured-log seam rather than a connected telemetry provider.

## Sources inspected

- `src/app/page.tsx` — browser page and loading/error/empty states.
- `src/app/api/v1/hq/dashboard/route.ts` — GET boundary, validation, authorization, response contract validation.
- `src/features/hq/dashboard.ts` — scoped dashboard read model and outlet drill-down query.
- `src/shared/contracts/dashboard.ts` — page request/response boundary and Zod validation.
- `src/server/db/memory-store.ts` — current file-backed pilot persistence adapter.
- `src/server/auth/port.ts` — current development session resolver and RBAC.
- `tests/unit/hq-dashboard.test.ts` and `tests/integration/dashboard-boundary.test.ts` — read-model and HTTP boundary coverage.

## Capability matrix

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Verified sales KPI | Completed `StoredSale`; payment split keeps verified/unverified digital amounts separate | `memoryStore.sales`, `memoryStore.payments` | `GET /api/v1/hq/dashboard` | Authenticated organization, narrowed by area/outlet | `IMPLEMENTED` on pilot store; production payment semantics remain a gap |
| Transaction count and average | Completed sales for the selected business day | `memoryStore.sales` | Same GET | Same server scope | `IMPLEMENTED` |
| Expense total and ratio | Expense rows joined to the shift business day | `memoryStore.expenses`, `memoryStore.shifts` | Same GET | Same server scope | `IMPLEMENTED` |
| Active / total / not-started outlets | Selling locations plus scoped shifts and current location reports | `memoryStore.sellingLocations`, `memoryStore.shifts`, `memoryStore.locationReports` | Same GET | Organization, area, stall, or self scope as applicable | `IMPLEMENTED` |
| Sales trend | Completed sales grouped into Jakarta-time business-day buckets | `memoryStore.sales` | Same GET | Same server scope | `IMPLEMENTED` |
| Outlet summary table | Location, active shift, operator, day sales, day expenses, derived status | Locations, shifts, operators, sales, expenses | Same GET; `/api/v1/hq/outlets/[outletId]` for drill-down | Server checks selected outlet visibility | `IMPLEMENTED` |
| Search and status filter | Read-model query parameters, applied before pagination | Same source records | GET `search`, `status`, `cursor`, `limit` | Server-side, not client-only | `IMPLEMENTED` |
| Date, area, and outlet filters | Business day, authorized area selection, and visible location selection | Same source records plus scoped area options | GET `date`, `areaId`, `outletId` | Organization/session scope is never accepted from the browser | `IMPLEMENTED` |
| Attention alerts | Recorded alerts, missing location reports, flagged expenses, open incidents | `memoryStore.alerts`, shifts, expenses, incidents | Same GET | Only visible outlets; unscoped alerts are excluded for narrower scopes | `IMPLEMENTED` |
| Recent activity | Append-only audit events resolved to source records | `memoryStore.auditEvents` plus source maps | Same GET | Organization plus visible outlet filter | `IMPLEMENTED` |
| Outlet drill-down link | Existing outlet-detail GET/page | Source records through feature query | `/hq/outlets/[outletId]?date=...` | Scope rechecked server-side; foreign outlet returns not found | `IMPLEMENTED` |
| Create transaction / expense buttons | Existing separate pages; dashboard has no mutation | Not written by dashboard | Links to `/sell` and `/expenses` | Destination page owns authorization | `UNSUPPORTED` on this page; navigation only |
| Analytics events | Stable dashboard event contract and best-effort POST seam | No analytics persistence | `POST /api/v1/analytics` | Session organization and actor are server-derived | `PARTIAL` — structured logger only |

## Authoritative store

- **Current pilot authoritative store:** `data/db.json`, loaded into `memoryStore` at process start and written atomically after map mutations. The directory is ignored and is not a checked-in fixture.
- **Production design store:** Drizzle/PostgreSQL schema exists elsewhere in the repository, but this dashboard path does not query PostgreSQL today.
- **Read path:** browser fetch → `/api/v1/hq/dashboard` → `resolveSession`/`authorize` → `getHqDashboard` → scoped `memoryStore` maps.
- **Write path for this page:** none. Dashboard CTAs navigate to other slices; they do not pretend to save from local React state.
- **Durability:** the pilot file adapter attempts atomic rename writes and reloads the JSON file. A production restart/durability proof against PostgreSQL is not available for this slice.

## Authorization ground truth

The route resolves the session on the server and calls `authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId })`. The query feature then applies area, stall, self, organization, and selected-outlet checks. The browser never supplies an organization or privileged role. Unit tests cover cross-tenant and cross-area outlet lookup; HTTP tests cover malformed filters and unauthenticated access.

Development currently uses `createAuthPort` with environment-controlled fake roles. It returns `null` in `NODE_ENV=production`, but it is not a production identity provider.

## Mock inventory for this page

- `src/server/db/memory-store.ts`: `// MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE` and deterministic seed data marker. Replace with the canonical PostgreSQL repository before calling the page integrated.
- `src/server/auth/port.ts`: `// MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE`. Replace with the real session provider.
- `src/shared/analytics/dashboard.ts` and `src/app/api/v1/analytics/route.ts`: `// MOCK ONLY — ANALYTICS NOT CONNECTED TO REAL TELEMETRY`. Replace the logger seam with the approved telemetry adapter.

These markers are deliberately not removed by this slice.
