# ADR-0017: Offline strategy: outbox queue with server authority

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-3
- **Area:** Offline
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Connectivity is intermittent, devices are cheap, and batteries die. Losing a recorded sale is unacceptable; duplicating one corrupts cash. Meanwhile the client must never decide a money state.

## Decision

Client records are written to an IndexedDB outbox with client-generated UUIDv7 ids and per-aggregate FIFO ordering, then replayed via a batch sync endpoint with per-record results (ACCEPTED/DUPLICATE/REJECTED/DEFERRED), exponential backoff, quarantine for corrupt entries, and no silent drops. The server is authoritative for prices, payment states, shift acceptance, stock expectations and permissions; the device is authoritative only for the fact that something was recorded at a device time (NFR-OFFLINE-*).

## Consequences

Positive: full offline day works; duplicates are structurally prevented; conflicts are visible to humans. Negative: sync complexity is real and must be tested with disconnection, corruption and multi-device scenarios (VS-16).

## Alternatives considered

Background Sync API as the reliability mechanism (rejected: inconsistent support); optimistic client-side PAID (rejected: fraud-enabling); local SQLite as the system of record (rejected: no central authority).

## Compliance impact

Offline queue holds only operator-recorded data, preserving data minimisation; quarantine export is explicit and record-scoped.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
