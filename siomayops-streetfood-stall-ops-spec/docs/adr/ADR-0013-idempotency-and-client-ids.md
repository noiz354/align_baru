# ADR-0013: Idempotency keys and client-generated IDs

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-3
- **Area:** Platform
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Retries, offline replays and flaky networks make duplicate submissions normal, not exceptional. Duplicated sales or payments corrupt cash reconciliation and destroy trust in the numbers.

## Decision

Every mutating request carries an Idempotency-Key; offline-creatable records carry a client-generated UUIDv7 stored as a unique alias `(organization_id, client_*_id)`. Replays return the original response, marked as a replay. A mismatched payload under the same key returns `IDEMPOTENCY_MISMATCH` and is surfaced to a human. Responses are cached with a bounded TTL.

## Consequences

Positive: at-least-once delivery becomes safe end-to-end; support can reconstruct device behaviour; duplicate detection is structural. Negative: key storage grows (pruned per retention R-21) and requires care with response caching for large payloads.

## Alternatives considered

Server-generated IDs only (rejected: cannot dedupe offline creations); client timestamps as keys (rejected: not unique); database unique constraints alone (rejected: insufficient because the client needs a deterministic response).

## Compliance impact

Duplicate-free financial records support the integrity expectations of audits and future tax/commercial reviews.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
