# ADR-005: Household Tenancy — Single-Household Rows with Scoped Ports

## Status
Accepted

## Date
2026-09-26

## Context
Every meaningful HomeOps record (rooms, chores, occurrences, trash containers, resources, assets, issues, alerts, activity) belongs to exactly one household. Cross-household leakage would be a privacy failure of the highest severity: it exposes routines, presence patterns and home problems (PRIVACY.md). The application is not multi-tenant SaaS with complex organisations; it is one household per deployment-instance-user in practice, though the schema must still be correct if two households exist. A user belongs to at most one household in v1 (PRD A-1). Authorization must hold for server-rendered reads, Server Actions, route handlers, and scheduled jobs alike.

## Problem
How do we guarantee, structurally and verifiably, that no code path can read or write another household's data — without importing enterprise tenancy machinery (organisations, RBAC service, row-level security policies) that a single maintainer cannot operate?

## Decision Drivers
- Isolation must be a property of the *shape of the code*, not of developer discipline alone (NFR-SEC-002).
- Only one isolation level is needed: household. Roles are coarse (owner/admin/member/helper).
- Must apply uniformly to interactive requests and background jobs.
- Must be testable: a test should be able to assert "this port cannot cross households".
- Minimal concepts for a one-developer product (NFR-MAINT-001).
- Must survive future multi-household users (A-1) without redesign.

## Options Considered
1. **Row-scoped tables + household-scoped repository ports** — every scoped table has `household_id`; every port method requires a `HouseholdContext`, and unscoped helpers do not exist.
2. **PostgreSQL Row-Level Security (RLS)** — database-enforced policies with a session variable per request; strong guarantee, extra operational concepts (policy review per table, connection setting discipline, debugging visibility).
3. **Schema-per-household** — hard separation, but migrations multiply, cross-household queries become impossible, and the operational burden is disproportionate at 3–10 users.
4. **Database-per-household** — strongest isolation, heaviest operations; unjustified.
5. **Application-only discipline (review conventions, no interface)** — cheapest, and exactly the pattern that produces cross-tenant bugs.

## Decision
Adopt **(1) row-scoped tables with mandatory household context at the port boundary**, with **RLS explicitly deferred** as a defence-in-depth layer rather than a v1 requirement.

Concretely:
- Every household-scoped table has a non-null `household_id uuid` FK with an index whose leading column is `household_id` where the access pattern requires it (DATA_MODEL.md).
- `HouseholdContext = { householdId, actorId, role, timezone, clock }` is produced **only** by `server/auth/context.ts` from the session — never from request bodies, query params, or headers (FR-HH-004).
- All repository ports take `ctx` as their first argument (see I-XA-001a for the two allowed shapes); there is no `listAll()`-style unscoped method. Aggregates address children through their parent's repository so the parent's scope applies.
- Scheduled jobs iterate households explicitly (`for each household: withContext(householdId)`), so the same scoping rules apply with no session.
- Cross-module composition passes `ctx` down; nothing reconstructs tenancy from a raw id.
- Domain rules do not re-check tenancy (it is structurally impossible to reach a port without a context); they do check *role*-based rules (e.g. only owner/admin removes members).

## Consequences

### Positive
- One concept to learn: "everything is scoped by the context you were given".
- Testable guarantee: integration tests call each port with a context for household A and assert no household B data is ever returned (tests/integration/household-isolation.test.ts).
- Works identically for request paths and background jobs.
- No policy-as-SQL to maintain; developers can read a query and see the filter.
- Leaves the door open: RLS can be layered later without changing application code.

### Negative
- The guarantee rests on types plus tests, not on the database engine — a determined shortcut (direct Drizzle use outside `server/db`) bypasses it.
- Role checks are still a manual step per use case; forgetting one is possible (mitigated by the authorization matrix + tests).
- `household_id` duplication on child tables adds columns and FKs that pure normalisation would avoid.
- Deeply nested entities need care: a completion belongs to an occurrence whose household must match.

## Risks
| Risk | Impact |
| --- | --- |
| A future adapter bypasses the context | Cross-household exposure |
| A composite query forgets the join-through-parent scope | Silent data mixing |
| A background job iterates without a context | Leakage into jobs/logs |
| Role check omitted on a privileged mutation | Privilege escalation (see THREAT_MODEL T-03) |

## Mitigations
- Import discipline: `drizzle-orm` and the client are imported **only** under `src/server/db`; a lint rule (VS-0, T-PLAT-006) fails the build otherwise.
- Port signatures make `ctx` non-optional at the type level; a missing context is a compile error, not a runtime check.
- Integration tests assert isolation for every port; new ports must add a row to the isolation test (checked in review).
- Privileged mutations are enumerated in docs/security/AUTHZ-MATRIX.md; each lists the required role and the task that implements it.
- Scheduled jobs receive a context factory, not raw ids; job shells document the iteration contract (`src/server/scheduler/jobs/*`).
- Logging uses ids only, never payloads (PRIVACY.md, NFR-PRIV-003), so a mis-scoped log cannot leak content.

## Revisit Conditions
- A real requirement for organisations/teams/multiple households per user (proposed ADR-020).
- A penetration test or incident demonstrates scoping gaps that code discipline did not prevent → adopt RLS as a second layer (new ADR).
- Multiple administrative roles per household with hierarchy complexity (would justify a policy engine).

## References
- PRD.md — FR-HH-003..005, FR-MEM-002, NFR-SEC-001..002
- SECURITY.md — §household isolation
- THREAT_MODEL.md — T-01, T-02, T-03
- docs/security/AUTHZ-MATRIX.md
- DATA_MODEL.md — `household_id` on every scoped table
- TASKS.md — T-HH-003, T-SEC-001, T-SEC-002
