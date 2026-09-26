# ADR-002 — Database

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture
- **Related:** [ADR-007](ADR-007-session-model.md), [ADR-012](ADR-012-ban-enforcement.md), [ADR-013](ADR-013-retention-policy.md)

## Context

StrangerLink has an unusual data profile: **almost nothing about a conversation is
durable**. Chat messages are ephemeral and deliberately not persisted
([RETENTION.md](../RETENTION.md)). What *is* durable is safety data: reports, bans,
blocks, moderation actions, and an audit trail.

Durable data characteristics:

- **Low volume, high integrity requirements.** A few thousand reports a day at most,
  but each one may be evidence.
- **Relational integrity matters.** A ban references an identity; a report references a
  session; a moderation action references a report. Referential integrity is a safety
  property, not a nicety.
- **Unguessable identifiers are required** (NFR-SEC-003).
- **Retention and deletion must be enforceable** (ADR-013).

Meanwhile the **hot** state — who is waiting in the queue, who is matched with whom,
live connection registries — is ephemeral and belongs in memory in the realtime service,
not in a relational store.

## Problem

Which durable datastore should StrangerLink use, and which state must *not* go into it?

## Decision Drivers

1. **Integrity of safety records.** Bans and reports must not be silently lost or
   partially written.
2. **Identifier quality.** Unguessable, collision-free, index-friendly identifiers.
3. **Retention enforcement.** Easy to implement time-based deletion and expiry.
4. **Operability.** One small team must run it.
5. **Query patterns.** Mostly point lookups by identity and time-range scans for audit.
6. **Cost.** Not a write-heavy OLTP workload; a modest managed instance suffices.

## Options Considered

### Option A — PostgreSQL 18

Released 2025-09-25. Async I/O subsystem (io_uring on Linux), native `uuidv7()`, virtual
generated columns, `RETURNING` old/new aliases, OAuth 2.0 auth, SCRAM (md5 deprecated),
skip scans. Available on RDS and other managed providers.

**Strengths:** Best-in-class relational integrity, constraints, and transactions.
`uuidv7()` gives time-ordered unguessable IDs. Async I/O is a genuine win for
audit-heavy write patterns. Managed options remove operational burden. Excellent
time-range and JSON querying for moderation triage.

**Weaknesses:** Requires connection pooling under concurrency (use PgBouncer or a
managed pooler). Vertical scaling ceiling — irrelevant at this volume.

### Option B — MongoDB

**Strengths:** Flexible schema, easy to start.

**Weaknesses:** Referential integrity for bans/blocks/reports is our responsibility, not
the database's. Weakening the integrity of safety records is unacceptable. Transactions
are workable but more awkward.

### Option C — MySQL / MariaiaDB

**Strengths:** Ubiquitous, well understood.

**Weaknesses:** Weaker JSON and constraint ergonomics. No advantage over PostgreSQL for
this workload.

### Option D — DynamoDB / other managed NoSQL

**Strengths:** Operational simplicity, predictable scaling.

**Weaknesses:** Query flexibility for moderation triage is poor. Retention jobs are
awkward. No referential integrity. Over-engineered for a low-volume, integrity-critical
workload.

### Option E — SQLite

**Strengths:** Zero operations.

**Weaknesses:** Cannot serve multiple application instances. Rejected outright for the
durable store.

## Decision

**PostgreSQL 18 is the single durable datastore.**

### What goes into PostgreSQL

Session metadata (not content), reports, blocks, bans, moderation actions and audit
events, safety events, admin users, and consent/age-gate event records.

### What must **not** go into PostgreSQL

| State | Where it lives | Why |
| --- | --- | --- |
| Live queue entries | In-memory in the realtime service (Redis only if multi-instance) | Ephemeral, high-churn, must not become a durable record of who talked to whom |
| Live connection registry | In-memory in the realtime service | Die with the process |
| Chat message content | **Nowhere durable** | Privacy and harm minimisation; see [RETENTION.md](../RETENTION.md) |
| WebRTC session descriptions / ICE candidates | In-flight only, relayed not stored | Ephemeral signaling; storing them is a privacy liability |
| TURN credentials | Computed on demand, never stored | Short-lived by design (ADR-006) |

### Identifier policy

- All durable identifiers use `uuidv7()` — unguessable and time-ordered.
- Session IDs carry ≥ 128 bits of entropy and are **never** sequential or derivable.
- Public-facing identifiers never encode a creation timestamp that an attacker could use
  to enumerate neighbours.

### Access policy

- Application connects with a least-privilege role; no superuser.
- SCRAM authentication; TLS required in transit and at rest where the platform supports
  it.
- All schema access goes through repository ports in `src/server/db/`. **No raw SQL
  outside those ports**, so retention jobs have one place to run.

## Consequences

**Positive**

- Safety records get real transactions: a report and its audit event commit together or
  not at all.
- Retention is a single scheduled job over a small number of tables.
- `uuidv7()` solves unguessability and index locality in one function.

**Negative**

- We must run a connection pooler once concurrency grows.
- Retention jobs are our responsibility — there is no automatic TTL.
- Two mental models (durable PostgreSQL vs. ephemeral in-memory) must be documented and
  respected; the boundary is stated in [DATA_MODEL.md](../DATA_MODEL.md).

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| A developer accidentally persists chat content | Critical | Medium |
| A migration accidentally adds a PII column | High | Medium |
| Connection exhaustion under a connection storm | Medium | Medium |
| Retention job silently fails and data is kept forever | High | Medium |

## Mitigations

- **MR-1:** Repository ports in `src/server/db/` are the **only** modules permitted to
  contain SQL. A test asserts no other module imports a database driver.
- **MR-2:** A schema-review checklist in [CONTRIBUTING.md](../CONTRIBUTING.md): every new
  column must be justified against the data-minimisation rule in
  [PRIVACY.md](../PRIVACY.md).
- **MR-3:** A scheduled test asserts that no table in the schema has a column named for
  message content (e.g. `body`, `text`, `content` on a message-shaped table).
- **MR-4:** Connection limits configured at the pooler; alert on pool saturation
  (NFR-OBS-001).
- **MR-5:** The retention job is idempotent, logged, and **alerts on failure**. A failed
  retention run is treated as a privacy incident, not a background error. See
  [RUNBOOK.md](../RUNBOOK.md).

## Revisit Conditions

- Durable write volume grows by more than an order of magnitude and connection pooling
  becomes the bottleneck → consider read replicas before considering another database.
- A moderation feature requires full-text search over reports at scale → add a search
  index (e.g. PostgreSQL FTS first, OpenSearch only if needed).
- The team adopts a managed platform whose datastore is a better operational fit.

## References

- PostgreSQL 18 release announcement —
  https://www.postgresql.org/about/news/postgresql-18-released-3142/
- [DATA_MODEL.md](../DATA_MODEL.md)
- [RETENTION.md](../RETENTION.md)
- [PRIVACY.md](../PRIVACY.md)
- [docs/research/STACK-2026.md](../research/STACK-2026.md)
