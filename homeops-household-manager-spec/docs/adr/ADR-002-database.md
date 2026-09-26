# ADR-002: Database — PostgreSQL 18

## Status
Accepted

## Date
2026-09-26

## Context
HomeOps stores a small, highly relational dataset: households → members → rooms → chores → occurrences → completions, plus trash containers, resources, assets/plans/records, issues, alerts, notification preferences, and an append-only activity log. Expected volume is small (tens of households; thousands of rows per household over years). Access patterns are strongly scoped by `householdId`, frequently ordered by time (`dueAt`, `createdAt`), and require a few transactional multi-write use cases (complete a chore + record completion + append activity + resolve alerts). The scheduler also needs a coordination primitive (a lock) and a durable queue-ish table for the outbox.

## Problem
Which storage engine provides relational integrity for tenancy, time-ordered indexing for "what's due", transactional multi-write use cases, a lock primitive for scheduling, and simple single-developer operations (backup, restore, upgrade)?

## Decision Drivers
- Household isolation must be provable with foreign keys and constraints, not application hopefulness (NFR-SEC-002).
- Time-ordered reads must be indexed and cheap (NFR-PERF-001, FR-DASH-001).
- Transactions for multi-aggregate use cases (chore completion → activity → alert resolution).
- Backup/restore and point-in-time recovery an individual can actually operate (NFR-REL-001).
- No second stateful service (ARCHITECTURE.md §3).
- Long-term stability: schema and data must survive years of small changes.

## Options Considered
1. **PostgreSQL 18 (managed or self-hosted)** — ACID, rich indexing (partial, GIN, BRIN, multicolumn skip-scan), `date`/`timestamptz` semantics, `uuidv7()`, advisory locks, JSONB for bounded extension, mature backup tooling.
2. **SQLite / libSQL** — lowest operational cost, but single-writer concurrency, weak fit for a separate scheduler process, fewer managed backup/PITR options.
3. **MySQL/MariaDB** — viable; weaker type system for our time/JSON needs and no reason to prefer it.
4. **MongoDB / document store** — good for heterogeneous shapes, poor for the relational integrity that enforces household scoping; alert/dedupe queries get awkward.
5. **Hosted BaaS (Firebase/Supabase-as-primary-API)** — fast start, but authorization moves into remote rules/SDKs and data leaves the operator's control (PRIVACY.md).
6. **Event-sourced store** — over-engineered for a household; see ADR-013 for the constrained outbox instead.

## Decision
Adopt **PostgreSQL 18.x** as the single production datastore. Guidelines:
- Every household-scoped table carries a non-null `household_id` FK to `household(id)` with `ON DELETE RESTRICT` for aggregates and `CASCADE` only for dependent children explicitly listed in DATA_MODEL.md.
- Primary keys are opaque `uuid` generated with `uuidv7()` (timestamp-ordered for index locality) — never sequential integers exposed to clients (FR-HH-012).
- Civil scheduling anchors use `date`; instants use `timestamptz` (UTC). Household timezone is stored once on `household` (FR-HH-006).
- Coordination for the scheduler uses `pg_advisory_lock` / `pg_try_advisory_lock` (ADR-013).
- Expected-volume-per-table and index requirements are declared in DATA_MODEL.md; no index is added without a query that needs it.
- Local development uses the same major version via Docker (DEPLOYMENT.md), not a divergent engine.

## Consequences

### Positive
- Tenancy enforced structurally: a missing `household_id` filter causes an FK/constraint or a test failure, not a silent leak.
- Powerful indexing for due-date and activity queries with modest effort.
- One dependency for data, locking, and the outbox — the whole "no second service" position (AP-5) rests on this.
- `uuidv7()` gives indexed, client-visible-safe identifiers out of the box.
- Upgrades are low-risk: PG 18's `pg_upgrade` retains planner statistics, and page checksums are on by default.
- JSONB remains available for bounded, schema-light needs (e.g. channel metadata) without a second store.

### Negative
- A server process to operate: backups, upgrades, connection limits, disk monitoring.
- Row-level security is available but deliberately *not* used; discipline lives in scoped repository ports (ADR-005), which is a weaker guarantee than RLS by construction.
- Postgres-specific features (`uuidv7`, advisory locks, JSONB operators) are not portable if the engine is ever swapped.
- Managed Postgres adds cost and a hosting decision (ADR-016).

## Risks
| Risk | Impact |
| --- | --- |
| A query forgot the household filter | Cross-household data exposure |
| Over-indexing from speculative design | Slower writes, confusing schema |
| Unbounded table growth (activity, alerts, notification attempts) | Storage and query degradation |
| Connection exhaustion from a single process | Outage |
| Free-tier/self-hosted host loses data | Total loss |

## Mitigations
- Repository ports accept a `HouseholdContext` and are the *only* path to these tables; integration tests assert that each port cannot return another household's row (tests/integration/household-isolation.test.ts skeleton).
- Indexes in DATA_MODEL.md each cite the query they serve; unused indexes are removed.
- Retention jobs prune activity, resolved alerts and delivery attempts per PRIVACY.md/OPERATIONS.md (T-ACT-004, T-OPS-002).
- Connection pooling is bounded (postgres.js pool, small max) and documented in PERFORMANCE.md; a pooler is only introduced if a serverless host is ever used.
- Nightly `pg_dump` plus a *tested* restore in the runbook (NFR-REL-001, RUNBOOK.md#restore-from-backup).
- Optional consideration of managed Postgres with PITR recorded in ADR-016.

## Revisit Conditions
- Data volume per household reaches millions of rows (would indicate a modelling problem first).
- Concurrency requirements outgrow a single primary (multi-region, thousands of concurrent members) — not plausible for this product.
- Deployment target moves to a genuinely serverless runtime with no long-lived connections (ADR-016 revisit).

## References
- PRD.md — FR-HH-003, FR-HH-006, FR-HH-012, NFR-SEC-002, NFR-REL-001
- DATA_MODEL.md — entity catalogue, indexes, deletion behaviour, expected volume
- docs/research/STACK-2026.md#3
- docs/operations/BACKUP-RESTORE.md
- TASKS.md — T-PLAT-003, T-PLAT-004
