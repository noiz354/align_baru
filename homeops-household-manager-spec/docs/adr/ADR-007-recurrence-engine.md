# ADR-007: Recurrence Engine — Calendar-Anchored Rules with Completion-Based Mode

## Status
Accepted

## Date
2026-09-26

## Context
Household routines repeat in human, irregular ways: "every day", "Monday and Thursday", "every second week", "on the 1st", "every 3 days", and critically **"a week after I last did it"** (filter replacement, deep cleaning). The household timezone matters (chores are due "today" in household time, not UTC), and DST transitions and month-length differences are real (FR-CHORE-016). A missed tick must not produce duplicates or gaps. Users will notice a wrong date immediately and stop trusting the app — this is one of the highest-precision areas of the product.

## Problem
How should recurrence be modelled and computed so that due dates are predictable, timezone-correct, idempotent, and explainable to a member ("why is this due Friday?") — without implementing a general calendaring engine (RRULE) that the product does not need?

## Decision Drivers
- The seven recurrence types in FR-CHORE-014 must be supported.
- Determinism: the same inputs must always produce the same next occurrence.
- Idempotency under repeated evaluation (scheduler retries, double taps).
- Timezone/DST correctness in household time; no "1 a.m. drift" quirks.
- Explainability: the UI must be able to state the rule in words.
- Testability without a database (pure functions).
- No dependency on a heavyweight recurrence library whose semantics we cannot fully audit.

## Options Considered
1. **Bespoke closed union of simple rules** (`DAILY`, `WEEKDAYS`, `EVERY_N_DAYS`, `EVERY_N_WEEKS`, `MONTHLY`, `EVERY_N_MONTHS`, `AFTER_COMPLETION`) computed in household time — small, auditable, exactly matches FR-CHORE-014.
2. **RFC 5545 RRULE (via a library)** — maximum expressiveness and interop, but large semantic surface (BYSETPOS, BYDAY with ordinals, EXDATE), library dependency, and behaviours we would have to learn and test anyway.
3. **Cron expressions per chore** — familiar to developers, hostile to household users, ambiguous DST behaviour, no completion-based mode, and editing UX is poor.
4. **Materialise all future occurrences ahead of time** — simple reads, but storage growth, painful rescheduling on edit, and arbitrary horizon decisions.
5. **Compute everything on read (no persisted occurrences)** — no materialisation job, but "overdue since", snooze and completion history have no anchor, and dashboard queries become expensive.

## Decision
Adopt **(1) a closed union of simple rules**, with **occurrence materialisation a short horizon ahead**, and a strict separation between two modes:

```text
CALENDAR-ANCHORED  (DAILY, WEEKDAYS, EVERY_N_DAYS, EVERY_N_WEEKS, MONTHLY, EVERY_N_MONTHS)
    nextDue = f(rule, anchorDate, householdTimezone)

COMPLETION-ANCHORED (AFTER_COMPLETION)
    nextDue = f(rule, lastCompletedAt ?? createdAt, householdTimezone)
```

Rules:
- Recurrence is evaluated in **household local time**; results are stored as a civil `dueDate` (schedule anchor) plus a `dueAt` instant derived from a household-configured default time-of-day.
- **Month arithmetic clamps, never rolls over**: "monthly on the 31st" in February is Feb 28/29, not March 3.
- **Every-N-days/weeks are anchored to a stable anchor date** (definition creation date or an explicit user-set anchor), not to "the last time it ran", so a late tick does not shift the series.
- **Completion-anchored** recurrence reads `lastCompletedAt`; skipping does **not** advance the series (a skip is not a completion), while completion does.
- **Materialisation** creates the next occurrence only when none is open (one-open-occurrence invariant, FR-CHORE-017), using a unique `occurrenceKey` for idempotency.
- **No catch-up storms**: if the app was offline for a week, only the current/next occurrence materialises; historical gaps appear in history as "no record", not as a backlog of chores.
- A rule's human description is produced by a formatter (`describeRecurrence`) so UI text and behaviour cannot drift.
- Timezone changes affect **future** computation only (FR-HH-008); existing occurrences keep their stored civil date and instant, except those not yet materialised.

## Consequences

### Positive
- Small semantic surface: 7 rules, each with a pure function and explicit edge-case tests.
- Household-time correctness is a first-class concern rather than a library detail.
- Completion-anchored mode is supported natively — the single most requested household pattern ("after I did it").
- Determinism makes the scheduler idempotent and the UI explainable.
- No dependency means no library semantics to audit or upgrade.

### Negative
- No RRULE expressiveness (e.g. "third Tuesday", "every other month on weekdays") — acceptable for v1, and extendable behind the same union.
- Multiple rules for one chore (e.g. "every Monday *and* the 1st") are expressed as separate definitions, which is simpler but slightly more setup.
- Month-clamping and DST rules are choices we must document and defend (done in docs/product/RECURRENCE.md).
- Two modes mean two code paths and two sets of tests.
- Materialisation horizon must be chosen and revisited (proposed: 14 days, configurable).

## Risks
| Risk | Impact |
| --- | --- |
| DST edge cases (23/25-hour days) produce off-by-one dates | Wrong due dates |
| Long inactivity creates undesirable catch-up | Backlog noise |
| `AFTER_COMPLETION` + clock change (device vs server time) | Drift and confusion |
| Monthly clamping surprises users | Trust loss |
| Timezone change mid-series alters expectations | Unclear due dates |

## Mitigations
- Server clock is authoritative for all writes; client time is never trusted (NFR-SEC, docs/product/RECURRENCE.md#clock-authority).
- Pure functions with injected `Clock` and timezone; tests are pre-declared in tests/unit/domain/chores/recurrence.test.ts and tests/unit/shared/time/timezone.test.ts.
- Explicit DST test cases enumerated as TODOs (spring-forward, fall-back, 23:00→01:00 boundaries) for the implementing slice.
- Skip/complete do not produce catch-up: documented in CHORES.md and enforced in the materialisation function (a missed past occurrence is not created retroactively).
- Timezone changes are audited (activity record) and only affect future materialisation.
- UI always shows the rule text next to the computed date ("Every 2 weeks, Fridays → due Fri 3 Oct"), so a wrong computation is visible immediately (DP-12).

## Revisit Conditions
- Users ask for pattern expressiveness beyond the seven rules (e.g. ordinals, "every other month").
- More than one anchor pattern per chore becomes common in practice.
- A DST or month-boundary bug reaches production → add a property-based test suite and reconsider clamping semantics.

## References
- PRD.md — FR-CHORE-014..018, FR-HH-008, FR-HH-009
- docs/product/CHORES.md, docs/product/RECURRENCE.md
- docs/domain/INVARIANTS.md — I-CHORE-*
- src/domain/chores/recurrence.ts (skeleton, throws NotImplemented)
- tests/unit/domain/chores/recurrence.test.ts
- TASKS.md — T-CHORE-021..026, T-TIME-001..004
