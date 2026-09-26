# ADR-0034: API versioning, error envelope, rate limits

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-1
- **Area:** API
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

Offline devices may run a stale build for weeks and replay queued records against a newer server, so accidental breaking changes must be impossible. Operators see errors on small screens with poor connectivity, HQ sees the same failures in dashboards, and the sync queue must distinguish a genuine rejection from a transient failure and from a duplicate.

## Decision

Version the path (`/api/v1`) and evolve additively within a version; removals or semantic changes require a new version and an ADR, with contract tests replaying recorded fixtures on every build and a `Deprecation` response header carrying a sunset date. Every error uses one envelope — `{ error: { code, message, details?, correlationId?, retryable } }` — with a canonical code taxonomy (`VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INVALID_TRANSITION`, `STALE_DATA`, `IDEMPOTENCY_MISMATCH`, `PAYMENT_NOT_VERIFIED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `NOT_IMPLEMENTED`); `message` is plain user-facing language, `code` is stable, and `retryable` drives queue policy. Rate limits are per actor and per route with documented buckets, `429` plus `Retry-After`, and tighter buckets for authentication, sync replay and provider webhooks.

## Consequences

Positive: stale devices keep working, queue policy lives in one place, support can search by code, localization is clean. Negative: some duplication during migrations and discipline to resist "quick" breaking edits.

Assessment gap: the operator sync bucket must tolerate a full offline day being replayed on reconnect without starving interactive requests.

## Alternatives considered

Header-based versioning (rejected: harder to debug, easy to forget); unversioned API (rejected: breakage is inevitable with offline clients); HTTP status codes alone (rejected: insufficient granularity); free-text errors (rejected: unhandleable by the queue).

## Compliance impact

Errors never leak personal or internal data; correlation IDs let support help a specific operator without exposing other records.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
