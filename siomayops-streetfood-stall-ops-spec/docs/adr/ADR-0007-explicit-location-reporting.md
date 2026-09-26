# ADR-0007: Explicit operator location reporting; no continuous tracking

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-3
- **Area:** Privacy/Location
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Continuous GPS tracking of workers is a privacy harm, a battery drain, and unnecessary: the product only needs to know where a stall is selling during a shift. Passive 24/7 collection would also trigger heavier UU PDP obligations and destroy operator trust.

## Decision

Location is captured only as an explicit, operator-initiated `LocationReport` that exists only while a shift is active (FR-LOCATION-004/005, NFR-PRIVACY-003/004). An optional one-shot "use my current position" control may pre-fill a proposed pin, but is never recorded as a trail and never runs in the background.

## Consequences

Positive: minimal personal data, low battery/data cost, trust-preserving, defensible under UU PDP purpose limitation. Negative: coverage data depends on operators reporting; HQ must prompt rather than detect. Revisit trigger: only with a new ADR and explicit, consented, shift-bounded tracking for a genuinely different use case (e.g. delivery fleet).

## Alternatives considered

Background geolocation / `watchPosition` loops (rejected); periodic pings for "safety" (rejected: false comfort, real surveillance); third-party analytics SDKs with location (rejected).

## Compliance impact

Directly supports UU PDP minimisation and purpose limitation, and avoids the systematic-monitoring trigger in Art. 53 DPO assessment.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
