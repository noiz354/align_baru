# ADR-0014: HTTP JSON API (no GraphQL, no tRPC)

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-1
- **Area:** API
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

The client is an offline-capable PWA that replays queued mutations with strict idempotency and per-record results. The HQ console needs predictable pagination and scoped reads. The team is small and the API surface is bounded.

## Decision

Use versioned REST-ish JSON route handlers under `/api/v1` with Zod-validated bodies, explicit error envelopes, cursor pagination, and idempotency keys. Sync uses a batch endpoint with per-record results.

## Consequences

Positive: trivially debuggable with curl, works with offline replay semantics, easy to secure per route, no schema/runtime to maintain. Negative: some over-fetching on HQ lists (mitigated by purpose-built read models and field selection).

## Alternatives considered

GraphQL (rejected: schema/runtime surface and query-cost control for no current benefit); tRPC (rejected: ties clients to TS and complicates offline replay and third-party/provider webhooks); gRPC (rejected: browser friction).

## Compliance impact

Explicit per-route authorization and audit mapping, simplifying security review and penetration testing.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
