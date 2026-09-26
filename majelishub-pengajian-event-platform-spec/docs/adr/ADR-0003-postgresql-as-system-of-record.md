# ADR-0003 — PostgreSQL 18 as the single system of record

- Status: Accepted · Date: 2026-09-26 · Deciders: Principal Architect, SRE, Security
- Requirements affected: FR-ORG-003, FR-ATTEND-001, NFR-SEC-003, NFR-REL-003
- Related: ADR-0004, ADR-0010, ADR-0014, ADR-0017

## Context

The domain is deeply relational and integrity-critical: an event belongs to a mosque and a
speaker; a registration belongs to an event and produces at most one attendance record; a
transcript has ordered revisions; a recording session has ordered chunks. Multi-tenancy
requires every scoped row to be attributable to an organization.

We also need a queue (ADR-0010), search (ADR-0014), and audit — each of which is commonly
solved with an additional stateful service.

## Decision

Use **PostgreSQL 18** as the single system of record for all relational and derived data:
events, registrations, attendance, recording sessions and chunk metadata, transcript
revisions, feedback, audit, notification outbox, **and** the job queue. Enforce invariants
with database constraints: `FOREIGN KEY`, `UNIQUE`, partial unique indexes, `CHECK`,
`EXCLUDE`, `ON CONFLICT`.

## Alternatives considered

- **MongoDB / document store.** Flexible schemas suit changing requirements, but the
  invariants here are relational and must be enforced by the database, not by application
  diligence. Multi-document transactions for check-in→attendance are the wrong tool for a
  high-frequency path. *Rejected.*
- **Postgres + Redis for queue/cache, Postgres + Elasticsearch for search.** Each addition
  multiplies operational surface (backups, upgrades, monitoring, memory limits, failure
  modes) for gains not required at this scale. *Rejected* (see ADR-0010, ADR-0014).
- **SQLite/Turso for small deployments.** Attractive simplicity, but concurrent writers
  (scanner + registration + workers) and the queuing model push beyond SQLite's comfort zone,
  and the same codebase must serve larger deployments. *Rejected.*
- **PostgreSQL 16/17.** Supported and mature, but selecting 18 (supported to Nov 2030) gives
  the longest runway at no cost. *Chosen: 18.*

## Consequences

**Positive:** one backup/restore story; transactional integrity across module boundaries;
`SKIP LOCKED` gives a durable queue; partial unique indexes make duplicate attendance
structurally impossible; `tsvector`/`pg_trgm` cover search; RLS is available as a tenancy
backstop.

**Negative:** Postgres becomes a single point of failure — mitigated by managed hosting or
tested backups + PITR; a growing job table needs housekeeping (`deleteAfterDays`); heavy
analytical queries must be avoided on the primary.

**Neutral:** the schema is a public interface inside the team; migrations must be reviewed like
code (no auto-apply in production).

## Enforcement

- Any new aggregate must carry the constraints from `DATA_MODEL.md` §Invariants.
- Schema changes ship as reviewed SQL migrations with a rollback note.
- A test asserts that duplicate attendance, duplicate registration and duplicate chunk inserts
  fail at the database level (`docs/testing/CONCURRENCY-TESTS.md`).
- No ORM feature may bypass constraints (e.g. no `upsert` that silently overwrites attendance).

## Revisit trigger

Reopen when: primary write throughput is measurably saturated (>70% sustained CPU IO wait),
a second datastore is required for a *measured* workload (e.g. analytics on >100M rows), or
read latency from a geographically distant replica becomes a user-visible problem.
