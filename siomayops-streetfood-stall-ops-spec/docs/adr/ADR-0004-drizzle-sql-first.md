# ADR-0004: Drizzle ORM and SQL-first data access

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Data
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

The money path needs readable, reviewable SQL. Heavy abstraction hides the queries that decide correctness of pricing, reconciliation and stock derivation. A codegen step adds CI complexity.

## Decision

Use Drizzle ORM (TypeScript schema, no codegen for types) on node-postgres. Migrations are generated as plain SQL by drizzle-kit, reviewed by a human, and applied by an explicit job. Raw SQL is permitted where it is clearer, but never built by string concatenation.

## Consequences

Positive: SQL reviewability, small runtime, first-class Postgres types, no codegen in CI, easy EXPLAIN inspection. Negative: no N+1 protection (mitigated by repository discipline and integration tests) and joins are manual.

## Alternatives considered

Prisma (rejected: heavier abstraction and generate step; acceptable alternative, not chosen); Kysely (viable, smaller migration story); TypeORM (legacy); hand-written SQL strings everywhere (rejected: no type safety at the money boundary).

## Compliance impact

Parameterised queries only, supporting OWASP-level defence against SQL injection (THREAT_MODEL T-14).

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
