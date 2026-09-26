# ADR-002: Database

Status: Accepted
Date: 2026-09-26

## Context

The data model (DATA_MODEL.md) is relational, small-to-medium scale (≤ 2k manga, ≤ 5M pages), single-writer workloads with bursty reads (catalog/search/progress). Requirements: strong integrity, JSONB for audit payloads, trigram search on titles, cursor pagination, 5-year support horizon, and trivial single-VM operation.

## Decision Drivers

1. Stable, supported major version with a long horizon.
2. Relational integrity + constraints (NFR-DATA-001).
3. Built-in text-search capability good enough for v1 (title/alias/creator/tag).
4. Operational simplicity on one VM (compose).
5. Ecosystem support from the chosen ORM (Drizzle) and drivers.

## Options Considered

### Option A — PostgreSQL 18 (18.6 current; 18.0 since 2025-09-22; EOL 2030-11-14)

Current stable major, ~12 months of broad production track record, 5-year support, trigram (`pg_trgm`) + GIN, UUIDv7-friendly, JSONB, excellent tooling (drizzle-kit, `postgres` driver).

### Option B — PostgreSQL 17 (17.11 current; supported to 2029)

Most conservative pick; everything we use exists in 17. Rejected only by a narrow margin — 18 adds no risk for our feature set and keeps us on the current major for the life of the project. **Contingency:** if any toolchain component (Drizzle 0.45, driver, compose image) proves incompatible, fall back to 17 without design change (documented here, not a new ADR).

### Option C — MySQL 8 / MariaDB

Rejected: weaker text-search story for our prefix+contains title search, no JSONB, no trigram equivalent of comparable quality; our data model uses PG idioms (citext, timestamptz, JSONB audit) throughout.

### Option D — SQLite (single file)

Rejected: no concurrent multi-writer (admin uploads + reader progress from many devices), no credible 5-TB-adjacent growth path with WAL at this access pattern; backup story weaker.

### Option E — CockroachDB / PlanetScale

Rejected: distributed-scale features we will not use for years; operational complexity and (for PlanetScale) multi-statement transaction restrictions that would complicate the upload commit (FR-UPLOAD-006 requires a multi-statement transactional commit).

## Decision

**PostgreSQL 18** as the single system of record, deployed via Docker Compose (local + single-VM production) or a managed equivalent (RDS/Neon/Supabase — any provider running PostgreSQL 18). Extensions enabled: `pg_trgm`. Connection: pooled via `postgres` driver (drizzle-orm/pg). No read replica in v1 (scale option, ARCHITECTURE.md §8).

## Consequences

### Positive
- 5-year support window outlives the project's realistic lifespan.
- `pg_trgm` GIN indexes give prefix+contains title search with zero extra services (FR-SEARCH-001/004; NFR-PERF-005).
- Citext, timestamptz, JSONB, CHECK constraints, and partial indexes match DATA_MODEL.md directly.
- Compose deployment is a one-line service; backups are `pg_dump`/WAL (DEPLOYMENT.md).

### Negative
- One more stateful service to operate (backup/restore/upgrade discipline required — RUNBOOK.md).
- PG major upgrades (18→19) are a yearly decision point (documented; not urgent: 18 supported to 2030).

## Risks

- **R1:** Extension availability on a managed provider. → `pg_trgm` is in core PG contrib and available on all major managed PG services; verified at environment bring-up (T-PROD-003).
- **R2:** Connection exhaustion under burst. → Driver-side pooling + `pgbouncer` optional (documented, not v1).
- **R3:** Slow unindexed queries regress NFR-PERF-014. → EXPLAIN checks in CI (T-PERF-004); index list in DATA_MODEL.md per table.

## Mitigations

Pinned compose image tag (e.g., `postgres:18.6`); daily logical backups + restore drill (T-PROD-004); query budget in CI; expand/contract migrations only (NFR-OPS-004).

## Revisit When

- Title-search latency at 10k+ titles exceeds NFR-PERF-005 with trigrams (add FTS `tsvector` or a dedicated search service — new ADR).
- Write volume exceeds single-node comfort (read replica first, partitioning second — new ADR if needed).
- PostgreSQL 19 adoption becomes mainstream (18 still supported; no forced action).

## References

- docs/research/2026-stack-validation.md (database section, refs [10][11])
- DATA_MODEL.md (full model + index plan), ADR-003 (access layer)
