# Product Spec — Recurrence

> Requirements: FR-CHORE-014..017, FR-MNT-004 · ADR: ADR-007 (the decision), ADR-006 (occurrence model), ADR-013 (scheduler) · Tasks: T-CHORE-021..026, T-TIME-002..004, T-MNT-003

## What this document must make unambiguous

A single implementer must be able to answer, without guessing: *what date is the next occurrence, which date does a late tick use as the base, what happens when a rule skips a day, and does a skip move the series?*

## Rule families

| Rule | Params | Next after a completed occurrence |
| --- | --- | --- |
| `NONE` | — | No next occurrence (one-off) |
| `DAILY` | — | Next household day, at the same time-of-day slot |
| `WEEKDAYS` | weekday set (subset of Mon–Sun; empty is invalid) | Next selected weekday strictly after the base date |
| `EVERY_N_DAYS` | N (1–365), anchor date | Base date + N days |
| `EVERY_N_WEEKS` | N (1–52), weekday, anchor | Base date + N×7 days, snapped to the weekday |
| `MONTHLY` | day-of-month d (1–31) | Next month's d (clamped to the month's last day) |
| `EVERY_N_MONTHS` | N (1–24), day-of-month d, anchor month | Anchor + N months, day d clamped |
| `AFTER_COMPLETION` | N days/weeks | Last **completion** instant + N (not the last due date) |

Rules are stored as a discriminated union, validated on write, and always rendered back as words (see Formatting below).

## Base date rule (the subtle part)

> **The next date is computed from the rule's own anchor or from the last completion — never from "now" and never from the tick time.**

- Calendar rules advance from the previous **materialised** slot, so a tick that runs late (server restart, DST, outage) produces the *correct* next date rather than shifting the whole series.
- `AFTER_COMPLETION` advances from the last completion instant, so a chore done late does not permanently shift the schedule forward — it re-anchors from reality.
- A **skip never advances** an `AFTER_COMPLETION` series (the work wasn't done); for calendar rules a skip advances the calendar slot as usual, because the *calendar* moved, not the performance.
- A **reopen** restores the pre-completion anchor; it never corrupts future dates.

## Materialisation

| Aspect | Rule |
| --- | --- |
| Horizon | One open occurrence per definition (never a pre-built queue) |
| Cadence | Scheduler tick (default 60 s) via pg-boss with `pg_try_advisory_lock`; also triggered opportunistically after a completion |
| Idempotency | Deterministic `occurrence_key` = `definitionId + slotDate`; unique constraint makes repeats impossible |
| Late tick | Produces at most one occurrence, dated by the rule — never "however many days were missed" |
| Paused/archived | Skipped entirely |
| Backfill | Not supported by design: creating 30 historical occurrences after a vacation would be noise, not truth |

## Timezones and DST

- All-day semantics are computed in the **household timezone**; storage is UTC (`timestamptz`) for records and `date` for all-day values.
- DST spring-forward: a due time that does not exist shifts to the same *civil* day's first valid instant (e.g. 02:30 → 03:00) and the shift is **not** counted as lateness.
- DST fall-back: a due time that occurs twice uses the **first** occurrence; the second is ignored.
- A household timezone change applies to **future** occurrences only; historical dates keep the timezone they were computed in (I-HH-002).
- Southern-hemisphere and date-line cases are covered by tests, not by assumption (T-CHORE-023).

## Month & year clamping

| Case | Behaviour |
| --- | --- |
| 31st in a 30-day month | Clamp to the 30th for that month only; the rule stays on the 31st |
| February | Clamp to 28 or 29 |
| 29 Feb annual | Clamp to 28 Feb in non-leap years |
| `EVERY_N_MONTHS` starting from a clamped date | The **rule** keeps the original day (31); individual occurrences clamp. Clamping never becomes the new anchor — this is the drift bug this rule exists to prevent |
| Multiple times per year (months-of-year) | Each selected month produces its own slot with the same clamping rules |

## Formatting (what the member reads)

| Stored rule | Displayed as |
| --- | --- |
| `DAILY` | "Every day" |
| `WEEKDAYS {Mon,Wed,Fri}` | "Every Mon, Wed, Fri" |
| `EVERY_N_DAYS {3}` | "Every 3 days" |
| `EVERY_N_WEEKS {2, Fri}` | "Every 2 weeks on Friday" |
| `MONTHLY {1}` | "On the 1st of each month" |
| `EVERY_N_MONTHS {6, 15}` | "Every 6 months on the 15th" |
| `AFTER_COMPLETION {7}` | "7 days after it's done" |
| `NONE` | "One-off" |

The chore detail page always shows the rule **and** the concrete next date ("Every 2 weeks on Friday · next: Fri 3 Oct"), so nobody has to parse a rule in their head. Singular/plural is handled ("Every 1 day" is never shown; it reads "Every day").

## Editing rules

| Change | Effect |
| --- | --- |
| Change interval N | Applies from the next materialisation; the open occurrence keeps its date unless "apply now" is chosen |
| Change anchor | Recomputes future dates from the new anchor; past history untouched |
| Switch family (calendar ↔ completion) | Allowed; the UI states that the next date will be recomputed and previews it |
| Change timezone | Belongs to the household, not the rule; future only |
| Pause/resume | Resume recomputes from the anchor (calendar) or last completion (completion-anchored) |

Every one of these passes through a preview: "3 upcoming dates will change" before saving (`T-CHORE-025`).

## Maintenance analogue

Maintenance frequencies reuse the same pure date math (`src/shared/time`): every N days/weeks/months/years and months-of-year. Differences: maintenance schedules are **date-based only** (no completion anchoring, no DST concerns), and `nextServiceAt` is derived and recomputable from the last service record (I-MNT-001).

## Test obligations

The recurrence module is the highest-value unit-test target in the codebase (TESTING.md risk map). Required suites: rule-by-rule next-date tables · late-tick convergence · DST both directions · clamping across 12 months and leap years · skip/reopen semantics for `AFTER_COMPLETION` · property tests (monotonic, never in the past relative to the base, no duplicates for one slot).
