# ADR-0038: Feature flags and vertical-slice gating

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Process
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

The product must be deployable before every capability exists, and some capabilities (digital payments, loyalty, recognition) carry financial, privacy or legal preconditions that must not be reachable by accident in an early deployment. Ad-hoc `if (env === ...)` checks scatter this control and are easy to get wrong.

## Decision

Every capability that touches money, privacy or external providers is gated by an explicit flag (organisation- and location-scoped) with a safe default: digital payments off, loyalty off, recognition off, customer-facing messaging off. Flags are configuration rows with an audit trail of who changed them and why, evaluated at the feature boundary rather than inside domain logic, and each carries a named owner and a review date. Kill switches exist for the payment provider adapter and for notification dispatch. Flags are not used to keep two implementations of the same logic alive.

## Consequences

Positive: slices can ship safely, risky capabilities cannot be enabled by accident, and rollback is possible without a deploy. Negative: flag debt if flags are not retired — each flag has a review date and is deleted once its capability is permanent, recorded in the flag register.

## Alternatives considered

Environment-only switches (rejected: coarse, unaudited, wrong blast radius); long-lived A/B experimentation on money behaviour (rejected: financial behaviour must be deterministic and reviewable); no gating (rejected: unsafe early deployment).

## Compliance impact

Ensures processing purposes cannot be activated before the corresponding privacy review and consent mechanics exist.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
