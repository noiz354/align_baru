# ADR-010: Room Status — Hybrid Derivation with Expiring Manual Override

## Status
Accepted

## Date
2026-09-26

## Context
Members need to answer "how is the house doing?" at a glance (hierarchy H-5). The naive solutions are both bad: (a) a manually set status is stale within hours and becomes noise nobody maintains; (b) an algorithmic "cleanliness score" is fake precision (DP-9) and invites gaming. What actually predicts "this room needs attention" in a household is whether a chore scoped to it is overdue. But reality also intrudes: a member may genuinely know the guest bathroom is dirty right now, independent of any chore, and must be able to say so — while that claim should expire rather than silently claiming permanence.

## Problem
How should room state be produced so that it is (1) usually correct without maintenance, (2) never fake, (3) correctable by a human, and (4) explainable ("why does HomeOps say the kitchen is dirty?")?

## Decision Drivers
- No invented numeric scores (DP-9, PRD NG-3).
- Minimal maintenance burden; state must be true without anyone updating it.
- Manual correction must be possible and must not become permanent truth.
- Explainability must be available on tap (FR-ROOM-003, FR-ALERT-014 analogue).
- The rule set must be small enough to test exhaustively and to trust.

## Options Considered
1. **Hybrid**: derive from chore state; allow an expiring manual override; `UNKNOWN` when there is no evidence.
2. **Manual only** — simple, honest, but stale; rooms show "clean" days after they are not.
3. **Derived only** — accurate for chore-tracked rooms, but useless for rooms with no chores and unable to express real-time human observation.
4. **Score-based (weighted signals → 0–100)** — rejected: fake precision, unexplainable, easily gamed.
5. **Time-since-last-cleaning** — intuitive, but a room cleaned 6 days ago may be spotless and one cleaned yesterday may be destroyed; also fabricates a cadence nobody agreed to.

## Decision
Adopt **(1) hybrid derivation with an expiring manual override**, expressed as a small, ordered rule set (evaluated in household time):

```text
RoomStatus ∈ { CLEAN, NEEDS_ATTENTION, DIRTY, CLEANING, UNKNOWN }

1. If a manual override is active (setAt + ttl not elapsed)        → override status, source = MANUAL
2. Else if a room-scoped chore occurrence is IN_PROGRESS           → CLEANING,  source = CHORE
3. Else if a room-scoped chore occurrence is overdue                → DIRTY,     source = CHORE
4. Else if a room-scoped chore occurrence is due today (not done)   → NEEDS_ATTENTION, source = CHORE
5. Else if the room has at least one completed room-scoped chore   → CLEAN,     source = CHORE (last completion visible)
6. Else                                                             → UNKNOWN,   source = NONE
```

Rules:
- **Precedence is fixed and documented**; the derived state is a pure function of (active override, room-scoped occurrences, clock, household timezone).
- **Manual override carries an explicit TTL** (default: until end of household day; options: 3 h, tonight, tomorrow) and an actor; when it expires, derivation resumes. Overrides are always visible as "set by Budi, 2 h ago".
- **`UNKNOWN` is a first-class, honest state** ("no chores tracked for this room"), not an error and never rendered as "clean".
- **`CLEANING`** exists because "someone is on it" is genuinely different information (and suppresses nagging — a real fatigue control).
- **Explainability**: every room exposes `statusReason` (rule that fired), `lastCleanedAt`, and the responsible occurrence(s). Tapping a status shows why.
- **No invented scores**, no percentages, no trend charts of "cleanliness".
- **Not in use** (FR-ROOM-008) rooms are excluded from derivation and from dashboards.
- Alert contribution: a room reaching `DIRTY` does **not** itself create an alert (that would duplicate `CHORE_OVERDUE`); it only appears in the dashboard's "Rooms needing attention" card (DP-4 — one condition, one alert).

## Consequences

### Positive
- State is correct without maintenance and free of fake precision.
- Members can always correct it, and corrections decay naturally instead of lying forever.
- "Why?" is answerable, which is what makes members trust derived state.
- Small rule set → exhaustive unit tests are feasible (tests/unit/domain/rooms/status.test.ts skeleton).
- No new alerts: room status reuses chore overdue signals, avoiding double reporting for one condition.

### Negative
- Rooms without chores are `UNKNOWN` forever until chores exist — acceptable, but onboarding should encourage at least one room chore (or rooms can be marked "not in use").
- Two sources of truth (manual and derived) require UI care so a member is never confused about which is active.
- Override TTL semantics across midnight and timezone changes need explicit tests.
- A room with many chores can be `DIRTY` because of one overdue chore; the card must name the chore, not blame the room.

## Risks
| Risk | Impact |
| --- | --- |
| Override used as a way to silence reality | Dashboard untruthful for a day |
| Ambiguous precedence when several rules fire | Inconsistent UI messaging |
| Rooms with no chores look broken (`UNKNOWN`) | Onboarding confusion |
| Timezone change flips "end of day" boundaries | Surprise expiries |

## Mitigations
- Override is bounded (max duration configurable per household, default: until end of day) and always attributed.
- Precedence order is fixed by this ADR and covered by tests that assert ordering.
- Onboarding copy treats `UNKNOWN` as "not tracked yet" with a direct "add a chore for this room" action (empty-state rule §9).
- TTL computation is done in household time with the injected `Clock`; timezone-change tests are pre-declared (T-TIME-004).
- The dashboard card lists the *reason* ("Bathroom: overdue — Deep clean"), satisfying DP-8 (visible accountability, not shame).

## Revisit Conditions
- Members report room status is not useful (would justify reducing to manual-only or to chore-derived only).
- A desire appears for per-room checklists (a different feature; would need its own ADR, and careful avoidance of scoring).
- Override usage dominates derived state (indicates the derivation inputs are wrong).

## References
- PRD.md — FR-ROOM-001..008
- docs/product/ROOMS.md
- docs/domain/INVARIANTS.md — I-ROOM-*
- src/domain/rooms/status.ts (skeleton)
- ADR-006 (chore model), ADR-008 (alert model — why rooms do not alert)
- TASKS.md — T-ROOM-001..010
