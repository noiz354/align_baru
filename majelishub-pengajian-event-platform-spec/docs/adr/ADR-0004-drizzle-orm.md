# ADR-0004 — Drizzle ORM over Prisma for data access

- Status: Accepted · Date: 2026-09-26 · Deciders: Principal Architect, QA
- Requirements affected: — (implementation choice) · Related: ADR-0003, ADR-0025

## Context

The data layer must express: partial unique indexes, `ON CONFLICT DO NOTHING`, `FOR UPDATE
SKIP LOCKED`, `tsvector`/`pg_trgm` indexes, `timestamptz`, JSONB for provider payloads, and
row-level security. Several critical behaviours are SQL-shaped by nature (idempotent check-in,
attendance upsert, chunk uniqueness, revision sequencing).

## Decision

Use **Drizzle ORM** with the `pg` driver and `drizzle-kit` for migration generation. Schema is
defined in TypeScript; queries are written in a SQL-shaped DSL; raw SQL via the `sql` template
is permitted where PostgreSQL features exceed the DSL (with a comment justifying it).

## Alternatives considered

- **Prisma 7.** *Gains:* a second, readable schema language, better Studio tooling, larger
  community, and in 2026 a much smaller client after the Rust engine removal. *Costs:* a
  codegen step in every CI run and container build, a translation layer between the schema
  language and PostgreSQL features we depend on (partial indexes, `SKIP LOCKED`, `ON CONFLICT`
  nuances), and a mapping exercise for every constraint we want enforced. *Rejected* — the
  deciding factor is that our integrity logic is SQL-shaped and must be reviewable as SQL by a
  human in a PR.
- **Kysely.** *Gains:* excellent type safety. *Costs:* no schema/migration toolkit of the same
  maturity; more hand-written DDL. *Rejected* for a small team.
- **Raw `pg` + hand-written SQL only.** *Gains:* total control. *Costs:* no schema-to-type
  derivation; drift between SQL and TypeScript types over time. *Rejected* as the primary
  interface (still used inside repositories where warranted).

## Consequences

**Positive:** no codegen step; migrations are plain SQL that a reviewer can read; constraint
semantics are not abstracted away; small runtime footprint in the container.

**Negative:** developers must know SQL — this is a hiring/reviewing constraint, not a defect;
fewer community tutorials than Prisma; relation loading is explicit (no implicit `include`),
which is more verbose but predictable.

**Neutral:** Drizzle's API surface has historically changed more often than Prisma's; versions
are pinned and majors require an ADR amendment.

## Enforcement

- Every query that mutates attendance, registration capacity or chunk ingestion must be
  covered by a concurrency test proving the constraint holds.
- Raw SQL must carry a comment naming the PostgreSQL feature that forced it.
- No feature code may import the schema; repositories return domain types
  (`ARCHITECTURE.md` §5).

## Revisit trigger

Reopen if: Drizzle requires ≥ 3 raw-SQL escapes per module on average, a Drizzle major upgrade
demands a rewrite of the schema layer, or Prisma publishes a schema-mode that expresses our
constraints natively and the team's SQL fluency changes.
