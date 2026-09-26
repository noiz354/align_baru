# ADR-0017 — Shared-schema multi-tenancy with layered enforcement

- Status: Accepted · Date: 2026-09-26 · Deciders: Principal Architect, Security
- Requirements affected: FR-ORG-003/005, NFR-SEC-003 · Related: ADR-0003, ADR-0005, `docs/security/AUTHZ-MATRIX.md`

## Context

MajelisHub must host many mosques/communities. Some deployments are one mosque; some are a
regional network; a future hosted edition might carry hundreds. Requirements include
organization isolation, mosque-level sub-scoping (a volunteer responsible for one mosque), and
public read surfaces (event pages) that are intentionally cross-organization.

Candidate models: database-per-tenant, schema-per-tenant, shared schema with a tenant column.

## Decision

**Shared schema with `organization_id` on every scoped aggregate**, plus an optional
`mosque_id` scope for finer grants. Enforcement is layered:

1. **Authorization guard** at every route/action boundary: resolves session → memberships →
   `TenantScope { organizationId, mosqueIds?: string[] }`. Absence of a scope is a 403, not a
   default.
2. **Repository signature requirement**: every scoped repository method takes `TenantScope` as
   its first parameter (type-level: it cannot be omitted). Repositories build the `WHERE`
   clause from the scope; ad-hoc queries in feature code are forbidden.
3. **PostgreSQL Row-Level Security (RLS)** as a backstop (P1, VS-13): policies on scoped tables
   using `current_setting('app.organization_id')`, set per transaction via
   `SET LOCAL` by the db adapter. RLS is defence in depth, **not** the primary control, because
   it depends on session state being set correctly.
4. **Tests**: an isolation suite enumerates every scoped endpoint and asserts a cross-org
   attempt fails (403/404) and leaks no existence information
   (`docs/testing/STRATEGY.md` §Isolation).
5. **Public projections**: public pages read from dedicated queries/views that expose only
   public fields, and are explicitly exempt from the scope requirement — with the exemption
   listed in one auditable place (`src/features/content/public-projections.ts`).

## Alternatives considered

- **Database per tenant.** *Gains:* strongest isolation; per-tenant backups; trivially provable
  separation. *Costs:* connection-pool explosion, migration automation across N databases, and
  operational tooling (create/backup/restore/patch) multiplied; a one-volunteer operator cannot
  run 40 databases. *Rejected* for MVP, reconsidered only if a paying enterprise deployment
  demands physical separation.
- **Schema per tenant.** *Gains:* isolation closer to per-database with one connection pool.
  *Costs:* migrations must run N times atomically; Drizzle/`search_path` complexity; cross-tenant
  analytics and the public archive become awkward; tooling and debugging suffer. *Rejected.*
- **Single tenant per deployment (one install per mosque).** *Gains:* simplest isolation story.
  *Costs:* the product's premise is supporting many mosques/communities, including a
  participant who attends several mosques; also multiplies operational cost linearly.
  *Rejected* as the only model (it remains a supported *deployment* choice: one organization).
- **RLS as the only control.** *Costs:* a single missed `SET LOCAL` (or a connection-pool reuse
  bug) silently widens access; policies are hard to test exhaustively. *Rejected as the sole
  mechanism*; kept as the backstop.

## Consequences

**Positive:** one database to operate; cheap to add tenants; cross-organization queries for a
hosted operator are possible; participant identity can be global while roles stay scoped.

**Negative:** every scoped query is one forgotten predicate away from a breach — hence layered
enforcement and a dedicated test suite; noisier neighbours share resources (mitigated by
scoping heavy jobs to the worker); per-tenant backup/restore is all-or-nothing (documented in
`docs/operations/BACKUP-RESTORE.md`).

**Neutral:** `organization_id` is denormalised onto child tables (e.g. `registrations` carries
both `event_id` and `organization_id`) to make scope filters cheap and RLS simple; the
denormalisation is enforced by composite foreign keys.

## Enforcement

- Repository methods that query scoped tables without a `TenantScope` parameter fail review and
  are caught by a type-level test (`expectTypeOf`).
- Isolation test suite must be green before any release; it enumerates endpoints from the route
  manifest so a new endpoint cannot be forgotten.
- Existence leakage: cross-org access returns 404 (not 403) for object fetches to avoid
  confirming existence.
- RLS enablement is verified by a test that removes the application's WHERE clause and asserts
  the database still refuses.

## Revisit trigger

Reopen if: a deployment contractually requires physical data separation; a single Postgres
instance cannot host the aggregate load (> 100 organizations with heavy media metadata); or a
compliance regime demands per-tenant keys.
