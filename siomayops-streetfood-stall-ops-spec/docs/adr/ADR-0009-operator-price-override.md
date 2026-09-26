# ADR-0009: Operator price override policy

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-4
- **Area:** Pricing
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Field reality includes events, promotions, negotiated rates at a location, and package deals. Refusing all field discretion pushes deviations outside the system; granting unlimited discretion destroys margin control. The question cannot be dodged: the organisation must decide who may deviate and how it is recorded.

## Decision

Support three explicit modes per organisation/location: HQ_ONLY (no field override), SUPERVISOR_APPROVED (operator requests; applies only with server-verified approval; offline → request queued), and OPERATOR_ALLOWED (CERTIFIED operators only, bounded by amount/percentage and controlled reasons, auto-expiring at shift end or ≤24 h, counted per operator per day). Every override is an audited record with base price, override price, reason, authoriser, and expiry. Changes to recorded sales are impossible.

## Consequences

Positive: deviations become visible and bounded instead of invisible; HQ gains a margin view. Negative: OPERATOR_ALLOWED requires bound configuration and daily review; supervisors must respond to requests (SLA needed).

## Alternatives considered

Unlimited operator discretion (rejected: margin risk); no overrides at all (rejected: workarounds outside the system); per-transaction approval by HQ (rejected: latency kills selling speed).

## Compliance impact

Overrides are visible in margin reporting, reducing concealed discounting and improving audit defensibility.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
