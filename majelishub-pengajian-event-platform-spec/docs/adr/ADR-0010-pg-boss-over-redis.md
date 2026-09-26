# ADR-0010 — pg-boss (PostgreSQL) instead of Redis/BullMQ for background jobs

- Status: Accepted · Date: 2026-09-26 · Deciders: SRE, Principal Architect
- Requirements affected: NFR-REL-004, NFR-OBS-003 · Related: ADR-0003, ADR-0020, `OBSERVABILITY.md`

## Context

Jobs needed: audio assembly, audio processing, transcription submission/polling, search
indexing, notification dispatch, retention runs, attendance finalisation, alert evaluation.
Volumes are modest and bursty: tens of events per week, a handful of jobs per event, plus
scheduled work. Correctness matters more than throughput: a lost notification or a lost
transcription job is a real user-visible defect, and a **duplicated** assembly or a duplicated
notification is worse.

The current stack is Postgres-only by decision (ADR-0003). Adding Redis introduces a new
stateful service that someone must run, back up, monitor and upgrade — for a team that is often
one volunteer.

## Decision

Use **pg-boss** on PostgreSQL 18 for all background work:

- Jobs are rows in a `pgboss` schema, claimed with `SELECT … FOR UPDATE SKIP LOCKED`.
- **Transactional enqueue:** the job row is inserted in the *same transaction* as the domain
  state change (outbox pattern), so "registration created but reminder never scheduled" cannot
  happen.
- Retries with exponential backoff, a dead-letter queue, `sendOnce`/singleton for dedupe, and
  cron schedules for recurring work (reminders, retention, alert evaluation).
- Handlers live in the worker process (ADR-0002 topology, ADR-0020 deployment).
- Queue retention is configured (`deleteAfterDays`) and monitored — the job table is not a log.

## Alternatives considered

- **Redis + BullMQ.** *Gains:* higher throughput (tens of thousands of jobs/s), FlowProducer
  for dependent job graphs, repeatable jobs, Bull Board UI, and an excellent TypeScript
  experience. *Costs:* a second stateful service (backup, memory limits, eviction policy,
  persistence config), non-transactional enqueue (the classic lost-job window), and a queue
  that can silently drop data under `maxmemory` pressure if misconfigured. *Rejected for MVP.*
  **This is the documented upgrade path** if measured need appears.
- **In-process workers (setInterval / event emitters).** *Costs:* jobs die with the process,
  no retry semantics, duplicates under multiple instances. *Rejected.*
- **Cloud schedulers/queues (SQS, Cloud Tasks, Inngest, QStash).** *Gains:* managed
  reliability. *Costs:* a vendor in the critical path of a self-hostable product, and
  transactional enqueue is lost (or requires outbox anyway). *Rejected as default*, OPTIONAL
  for a deployment that already runs on that cloud.
- **Kafka / NATS.** *Rejected:* no streaming consumers; domain events are facts, not a stream
  (see `EVENTS.md`).

## Consequences

**Positive:** one datastore to back up; ACID job state; transactional enqueue; no new
infrastructure; jobs are queryable with SQL for debugging; dead-letter inspection is trivial.

**Negative:** job pickup latency is tens of milliseconds, not sub-millisecond (irrelevant
here); throughput is bounded by Postgres writes (~1–5K jobs/s theoretical, far above our
needs); the job table needs housekeeping; there is no built-in dashboard (a simple internal
`/operasional` page over `pgboss` tables is planned in VS-14).

**Neutral:** if the product ever needs high-frequency streaming jobs (e.g. live captioning),
pg-boss is the wrong tool and that feature would come with its own ADR.

## Enforcement

- Domain code may not call a job handler directly; handlers are only reachable through the
  queue (`src/server/jobs/queue.port.ts` is the only entry point).
- Enqueue must happen inside the writing transaction; a test asserts that a rolled-back
  transaction leaves no job behind.
- Every handler must be idempotent, and a concurrency test must run the same job twice with the
  same idempotency key asserting a single effect.
- `deleteAfterDays` is set; an alert fires if the jobs table exceeds a configured row count
  (`OBSERVABILITY.md` §Alerts).

## Revisit trigger

Reopen if **any** of: sustained > 100 jobs/second; a need for job dependency graphs or
fine-grained rate-limited queues; job-table maintenance becoming a recurring operational task;
or the product adds a streaming/live feature that requires sub-second dispatch.
