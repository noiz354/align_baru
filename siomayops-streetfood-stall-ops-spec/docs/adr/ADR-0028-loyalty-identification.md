# ADR-0028: Loyalty identification and fraud-resistant redemption

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-11
- **Area:** Loyalty
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

Repeat customers matter, but loyalty programmes are a classic source of unbounded liability, privacy harm (customer tracking) and fraud (double redemption, one account shared by many, staff self-award). This phase must not implement a points algorithm, but it must fix the identity and redemption rules that everything later depends on.

## Decision

Identification is explicit and consented: phone-number hash, rotating QR token, or an anonymous device token; no silent identification and no customer profile without recorded consent. Earn and redeem rules are configuration rows versioned by `rulesVersion`, with the liability value of a point documented in minor units and bounded per period. Redemption issues a single-use `RewardInstance` whose uniqueness is enforced by a database constraint, so concurrent redemption attempts resolve to exactly one winner and the losers receive an explicit, non-punitive message. Public surfaces never expose customer identity or individual operator ratings.

## Consequences

Positive: bounded liability, explainable rules, no opaque algorithms, and fraud resistance that does not depend on staff vigilance. Negative: a rules-table abstraction to maintain and field training on when loyalty is and is not offered; small operators may not enable it at all.

No scoring or points mathematics is implemented in this phase.

## Alternatives considered

Real-time points spendable across channels without reconciliation (rejected: uncontrolled liability); gamified variable rewards (rejected: manipulation risk); customer profiling for marketing (rejected: purpose limitation); identification by staff guesswork (rejected: privacy and fraud).

## Compliance impact

Consent-based enrolment only; loyalty data is held separately from operator performance data; retention and opt-out are honoured through the deletion pipeline.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
