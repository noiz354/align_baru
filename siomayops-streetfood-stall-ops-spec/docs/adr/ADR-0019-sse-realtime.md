# ADR-0019: Realtime via SSE, polling by default

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-12
- **Area:** Platform
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

HQ wants live-ish updates (new alerts, incident arrivals, active stall changes). Traffic is server-to-client; clients already write over normal HTTP. WebSockets add bidirectional complexity we do not need and can be blocked by intermediaries.

## Decision

Keep polling (TanStack Query 30–60 s intervals) as the default for HQ cards, and use Server-Sent Events for the few genuinely live surfaces (alert inbox, incident stream, optional live location board). SSE runs over plain HTTP, auto-reconnects with Last-Event-ID, and needs no upgrade handshake. Mobile operator screens never hold long-lived streams.

## Consequences

Positive: minimal infrastructure, proxy-friendly, gap recovery for free; less battery/data on mobile. Negative: one-way only (fine, since writes are HTTP); connection count per HQ user is a capacity consideration.

## Alternatives considered

WebSockets/Socket.IO (rejected: bidirectional complexity, proxy friction); Kafka/Pulsar (rejected: no consumer justifying it); long-poll loops from device (rejected: battery/data cost).

## Compliance impact

No personal data in stream payloads beyond what the viewer is already authorised to see; scope is enforced per subscription.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
