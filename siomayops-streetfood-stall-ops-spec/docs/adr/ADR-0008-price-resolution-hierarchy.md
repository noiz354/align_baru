# ADR-0008: Deterministic price resolution hierarchy

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-4
- **Area:** Pricing
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Prices vary by area and by selling point, and operators need one unambiguous number at sale time. Ambiguity or silent fallbacks would cause disputes and margin loss.

## Decision

Resolve prices deterministically: collect active policies matching ORG/AREA/LOCATION, prefer the most specific scope, break ties by the most recent `effectiveFrom`, fail loudly on an exact tie, and treat the absence of any policy as "not sellable" rather than zero. Every resolution returns provenance (policy id) that is stored on the sale line.

## Consequences

Positive: explainable, testable, auditable; supports disputes ("why was this price used?"). Negative: requires discipline in policy management; HQ must publish prices before a new item can sell at a location.

## Alternatives considered

Operator-set ad-hoc prices (rejected: ungoverned); last-write-wins global price (rejected: no location awareness); implicit fallback to a default price (rejected: silent repricing).

## Compliance impact

Price provenance is stored per sale line, making margin and dispute analysis possible without touching historical records.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
