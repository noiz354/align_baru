# ADR-003: Data access

Status: Accepted (provider/version caveats noted below)
Date: 2026-09-26

## Context
Greenfield authorized manga reader requires dependable production foundation with simple operations, security and bounded reader/media performance. This decision governs future implementation, not implementation now.

## Decision Drivers
Stable support; mature ecosystem; operational simplicity; clear module boundary; licensing/security; performance on mobile; testability; data integrity.

## Options Considered

### Option A
Drizzle ORM behind repository ports; SQL/data access confined to server/db; migrations deferred.

### Option B
Prisma ORM

### Option C
Kysely / raw SQL

## Decision
Drizzle provides typed schema/query approach with explicit SQL and comparatively thin abstraction; Prisma offers strong generated-client ergonomics but generator/migration conventions; Kysely excellent query builder but asks more SQL fluency. Risks maturity/API shifts and ORM leakage; isolate ports, review SQL, require DB constraints and integration tests. Revisit after compatibility benchmark or team expertise change. This is a constraint, not authorization to implement. Stack exact versions must be revalidated and pinned at kickoff.

## Consequences

### Positive
Clear default and migration boundary; avoids premature distribution and provider dependence where possible.

### Negative
Selected choice still requires operational expertise, periodic upgrades, and compatibility testing; some provider/library decisions remain open.

## Risks
Ecosystem changes or poor workload fit.

## Mitigations
Use adapter boundaries, operational tests and version review.

## Revisit When
after compatibility benchmark or team expertise change.

## References
https://orm.drizzle.team/docs/ ; https://www.prisma.io/docs/orm ; https://kysely.dev/
