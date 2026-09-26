# ADR-0003: PostgreSQL 18 as system of record

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Data
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Money records must be transactional, relational and auditable. The domain is naturally relational (shift → sale → payment → expense → closing) and every state change needs constraints, not conventions.

## Decision

Use a single managed PostgreSQL 18 database as the system of record, and also as the job queue (ADR-0018), outbox, and read-model store. No secondary datastore in Phase 0/1.

## Consequences

Positive: ACID transactions for money paths, partial unique indexes encode invariants (INV-03/04/06), jsonb for raw provider payloads, operational simplicity (one backup/restore story). Negative: the database becomes the growth bottleneck at very large scale (mitigated by indexing, read models, partitioning later). PostgreSQL 14 reaches EOL Nov 2026, so 18.x is the supported baseline.

## Alternatives considered

MongoDB (rejected: weak multi-row transactions for money); MySQL/MariaDB (rejected: fewer useful Postgres features); distributed SQL (rejected: ops cost); SQLite-only (rejected: needs central authority for HQ visibility).

## Compliance impact

Retention, deletion and audit obligations (UU PDP) become implementable with SQL-level precision and provable jobs.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
