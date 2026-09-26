# ADR-0029: Operator recognition scoring philosophy

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-15
- **Area:** People
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

Recognition shapes behaviour. A revenue-only leaderboard systematically rewards operators at high-traffic locations, punishes those at quiet ones, and invites gaming (proxying stock, unrecorded cash, inflated expenses, voided sales). A hidden "AI score" is worse: it judges people with no audit trail and no appeal. The organisation still wants to recognise good work.

## Decision

Recognition is transparent, multi-factor, normalised and reviewable. Candidate inputs come only from `OperatorPerformanceSnapshot` (data-quality and consistency measures, service indicators such as sale completion and void rate, stock discipline, expense-submission quality, incident handling, customer-aid signals), each with a published weight range. Normalisation accounts for traffic level, weather band, shift duration and time of day, day of week, closures and stock availability, with minimum sample-size gates before anyone is assessed. Humans review before any award; awards are appealable; no automatic negative consequence follows from the score; results are visible to the operator and their supervisor, never publicly. No scoring implementation exists in this phase.

## Consequences

Positive: defensible awards, reduced gaming incentive, acknowledgement of genuinely hard locations, and a basis for coaching. Negative: more design effort than a leaderboard, and normalisation needs enough data (the gates handle thin samples).

Open question for VS-15: which weight ranges are published to operators versus supervisors (product decision, must be documented before implementation).

## Alternatives considered

Revenue-only ranking (rejected: unfair and gameable); hidden algorithmic scoring (rejected: unauditable and disrespectful); no recognition programme (rejected: losing a real motivational tool); automatic sanctions from scores (rejected: punitive and error-prone).

## Compliance impact

No surveillance inputs, no public individual ratings, documented weights and process, and an appeal route — supporting fair treatment and worker privacy.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
