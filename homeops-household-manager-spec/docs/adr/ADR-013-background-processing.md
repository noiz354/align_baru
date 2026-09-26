# ADR-013: Background Processing — In-Process Scheduler with DB Single-Flight; pg-boss as the Upgrade Path

## Status
Accepted

## Date
2026-09-26

## Context
HomeOps needs scheduled work: materialise due chore occurrences (ADR-007), evaluate alerts (ADR-008), compute maintenance due (ADR-012), drain the notification outbox (ADR-009), and run retention pruning (PRIVACY.md). Frequencies are minutes; volumes are hundreds of rows per household; jobs are idempotent by design. There is no real-time requirement, no fan-out, and no throughput pressure. The deployment is a single Node process (ADR-016), which can host a scheduler — but only if double-execution is impossible when the process restarts or when a second instance exists during a rolling deploy. ARCHITECTURE.md §3 forbids adding a second stateful service unless a requirement demands it.

## Problem
Where does scheduled work run, and how is it made single-flight, idempotent, observable and idempotent-under-retry without introducing a broker, a worker fleet, or a new operational concept?

## Decision Drivers
- No Redis / no broker unless a requirement proves the need (AP-5).
- Exactly-once *effects*, at-least-once *execution*: idempotent jobs are the correctness mechanism.
- Must not double-run across instances or restarts.
- Must be observable: last run, duration, failures (NFR-OBS-003).
- Must tolerate being blocked during deploys/restarts without permanent gaps.
- Cheap upgrade path if durability/retries become necessary.

## Options Considered
1. **In-process scheduler + `pg_try_advisory_lock` single-flight + idempotent jobs**, triggered by an interval in the server process, with a manual/HTTP trigger (route handler) as a fallback.
2. **pg-boss (Postgres-backed queue)** — durable jobs, retries, dedupe keys, cron scheduling, no Redis; more machinery than v1 needs, but the natural V2.
3. **BullMQ + Redis** — richest queue UX; adds a second stateful service for throughput we will never approach.
4. **Host cron + HTTP trigger endpoint** — simple and robust externally, but the endpoint becomes an unauthenticated attack surface unless strictly guarded; also splits scheduling config across deployment files.
5. **Vercel Cron / managed scheduler** — ties us to a serverless host that ADR-016 rejects.
6. **Database-only `pg_cron`** — jobs would live in SQL, which contradicts domain-in-domain-modules (AP-2) and makes job logic untestable in Vitest.

## Decision
Adopt **(1)**, with a documented upgrade path to **(2)**.

Design:
- **Job registry** (`src/server/scheduler/jobs/*`): each job declares `{ name, schedule (cron), timeout, run(ctx, clock) }`, is idempotent, and reports metrics. Jobs implemented in later slices: `materialise-chores`, `evaluate-alerts`, `evaluate-maintenance`, `drain-notifications`, `prune-retention`, `consistency-sweep`.
- **Single-flight**: each tick acquires `pg_try_advisory_lock(<jobKey>)`; if unavailable, the tick exits immediately with a `scheduler_skipped` metric. Advisory locks are per-job, so unrelated jobs never block each other.
- **Household iteration**: jobs iterate households resolved from the database and construct a `HouseholdContext` per household (never a session) — tenancy rules are identical to request paths (ADR-005).
- **Tick cadence**: every 60 s for alert maintenance; recurrence materialisation every 10 min; retention daily at a low-traffic hour in the household's timezone bucket. Cadences are configuration, not code.
- **Idempotency**: unique constraints (`occurrenceKey`, alert `dedupeKey`, notification intent key) make re-execution safe. A job's *effect* must be the same whether it runs once or five times.
- **Failure handling**: a throwing job records the error, increments `scheduler_job_failures_total`, and leaves no partial state (each job runs in a transaction). Next tick retries. Three consecutive failures on the same job raise an operator-visible signal (OPERATIONS.md#signals).
- **Overlap protection**: a job that exceeds its timeout is abandoned (transaction rollback) and reported; `scheduler_job_timeouts_total` is tracked.
- **Outbox**: writes that must result in delivery (notification intents) are inserted in the same transaction as the domain change; the drain job consumes them. This is the only queue-shaped table in v1.
- **Manual trigger**: `POST /api/cron/[job]` requires a shared secret header and is rate limited; it exists for operations (backfill, after-restore) and for hosts without an in-process loop.
- **Multi-instance safety**: because locks and idempotency are database-level, running two instances is safe for correctness (though not required).

## Consequences

### Positive
- Zero new infrastructure; one process, one database, matching ARCHITECTURE.md §3.
- Job logic is ordinary TypeScript in modules, testable with Vitest and a test database.
- Single-flight is enforced by the database, not by hoping deploys are serialised.
- Idempotent jobs make deploy-time interruptions harmless.
- The outbox gives at-least-once delivery with no broker.

### Negative
- Job execution depends on the web process being alive; a crash-looping app also stops scheduled work (mitigated by health checks + operator alerting).
- No built-in retry backoff/queue-depth visibility beyond our own metrics.
- Long-running jobs compete with request handling (mitigated by small batch sizes and timeouts).
- Two scheduling call sites exist (in-process loop and the HTTP trigger), which must stay in sync — a job registry prevents divergence.
- Advisory locks require an actual Postgres connection held for the job duration (pool sizing must account for it).

## Risks
| Risk | Impact |
| --- | --- |
| Scheduler silently stops | Alerts stale, occurrences unmaterialised |
| Job not idempotent (implementer error) | Duplicates on retry |
| Long job blocking the connection pool | Request latency spikes |
| Timezone-based scheduling misfires at DST | Wrong run windows |
| Outbox grows unbounded on repeated failures | Table bloat, DB pressure |

## Mitigations
- Health endpoint exposes `lastSuccessfulTickAt` per job; a staleness threshold (15 min for the 60 s jobs) is an operator alert (OPERATIONS.md#signals, RUNBOOK.md#scheduler-stalled).
- Every job's idempotency mechanism is named in its file comment and asserted by an integration test (planned: "run twice, assert single effect"). Skeletons in `src/server/scheduler/jobs/*` enumerate the invariant each job must preserve.
- Jobs use `LIMIT`-bounded batches with per-item transactions (not one giant transaction) and a hard timeout.
- Schedule buckets are defined in household time; the tick itself runs on server time and computes per-household windows explicitly.
- Outbox rows older than a threshold with repeated failures move to a dead-letter state and raise an operator signal rather than retrying forever.

## Revisit Conditions
- Notification delivery latency or durability requirements exceed the outbox (e.g. guaranteed delivery windows) → adopt pg-boss (proposed ADR-018).
- More than one long-running job type appears, or jobs exceed the request process's resource budget (would justify a separate worker process/container — still using pg-boss, not Redis).
- The deployment becomes multi-instance *with high job volume*, where per-tick locking becomes a throughput constraint.

## References
- PRD.md — FR-NOTIF-008, FR-CHORE-017, FR-ALERT-005, NFR-REL-004, NFR-OBS-003
- ARCHITECTURE.md — §3 simplicity budget, §11 failure behaviour
- OBSERVABILITY.md — scheduler metrics
- RUNBOOK.md — #scheduler-stalled, #outbox-backlog
- src/server/scheduler/tick.ts, src/server/scheduler/locks.ts, src/server/scheduler/jobs/* (skeletons)
- ADR-002 (database locks), ADR-009 (delivery), ADR-016 (deployment)
- TASKS.md — T-PLAT-010..014, T-NOTIF-010
