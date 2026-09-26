# ADR-0030: Stock variance reasons and non-accusation policy

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-8
- **Area:** Inventory
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

Stock counts and reported sales will never match exactly: portion size, waste, spoilage, sampling, staff meals, spillage, unrecorded giveaways, weather, and simple counting error. A system that treats variance as theft leaves operators afraid to report honestly — which makes the numbers worse, not better.

## Decision

Every variance is explainable by a reason code chosen from a configurable list plus a free-text note, including the explicit reason `UNKNOWN`. The UI wording is neutral ("selisih", never "kehilangan"), never accusatory, and never labels a person. Escalation beyond a configured threshold requires a two-person human review with a documented conclusion, and coaching is the default follow-up; sanctions are out of the product's scope. Variance trends are reviewed per stall and per location with attention to environment (weather, closures, stock-outs) before any conclusion about a person.

## Consequences

Positive: honest reporting, better data quality over time, and reduced fear. Negative: some variance remains unexplained (accepted as the honest state); supervisors need guidance to interpret variance (covered in `docs/finance/STOCK-VARIANCE.md`).

## Alternatives considered

Automated accusation or automated penalty (rejected: destroys reporting honesty and risks injustice); variance hidden by tolerance bands (rejected: hides signal); requiring exact counts before closing (rejected: blocks the end of a shift).

## Compliance impact

Protects workers from automated accusation; the audit trail records reasons and review conclusions rather than personalities.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
