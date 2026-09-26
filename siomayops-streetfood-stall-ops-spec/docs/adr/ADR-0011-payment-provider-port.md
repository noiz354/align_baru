# ADR-0011: Payment provider abstraction boundary

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-6
- **Area:** Payments
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Indonesian digital payments involve providers (PJSPs) with differing APIs, signing schemes and settlement models. Hard-coding one provider into the sales domain would make replacement expensive and would leak provider concepts into accounting views.

## Decision

Define a `PaymentProvider` port (createPayment, getStatus, verifyCallback, refund where applicable) and keep provider-specific code in adapters under `src/server/payments`. Domain and features see only provider-neutral `Payment`, `PaymentAttempt` and verified-evidence records. Adapters map provider payloads (including decimal amount strings such as "10000.00") into `Money` at the boundary.

## Consequences

Positive: provider swap without domain changes; testability with a scriptable fake adapter; clear place to enforce signature verification. Negative: an abstraction seam to maintain; some provider specifics (e.g. unusual refund semantics) need explicit mapping documentation.

## Alternatives considered

Direct integration in the sales module (rejected: coupling); a third-party orchestration SaaS as the only path (rejected: dependency and data-flow implications without contractual review); no abstraction with only cash (rejected: blocks VS-6 deliberately).

## Compliance impact

Payment secrets, signature verification and raw payload retention are all confined to the adapter layer, simplifying security review.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
