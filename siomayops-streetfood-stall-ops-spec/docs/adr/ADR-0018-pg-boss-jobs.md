# ADR-0018: Background jobs with pg-boss (no Redis)

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-10
- **Area:** Platform
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

We need reliable scheduled and deferred work: payment sweeps, read-model builds, alert evaluation, notification dispatch, retention jobs, reconciliation checks. Adding Redis introduces a second stateful service to run, back up, secure and reason about.

## Decision

Use pg-boss on the existing PostgreSQL: transactional enqueue in the same transaction as the business write (outbox pattern), retries with backoff, dead-letter queue, cron and throttling. The worker runs from the same container image as the web process with a different entrypoint.

## Consequences

Positive: one database to operate and back up; enqueue and business writes commit atomically, eliminating the "job enqueued but data rolled back" class of bugs; job data is covered by the existing backup/restore process. Negative: throughput ceiling far below Redis-based queues (irrelevant at our scale); job table requires pruning (configured).

## Alternatives considered

BullMQ + Redis (rejected: extra stateful service and memory management); Temporal (rejected: whole server/worker model for one team); Inngest/hosted workflows (optional, but external dependency in critical paths); in-process cron (rejected: no visibility, no retries, no DLQ).

## Compliance impact

Auditability: job executions and failures are database rows, making operational evidence available for review.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
