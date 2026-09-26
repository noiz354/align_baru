# Product Spec — Trash & Collection

> Requirements: FR-TRASH-001..009 · ADR: ADR-008 (alert/state model) · Design: docs/design/PAGES.md §4, DESIGN.md §7 · Tasks: T-TRASH-001..010

## Purpose

Trash is the most universal household chore and the most annoying to miss: it is time-bound (collection day), it smells, and everyone notices when it fails. HomeOps makes the state of every bin obvious from the doorway screen and puts the right person on the right bin at the right moment.

## Model

A **TrashContainer** has a name ("Kitchen bin", "Recycling"), a kind (`ORGANIC | RECYCLABLE | GENERAL | HAZARDOUS | BULKY`), an optional location note ("balcony", "behind the gate"), an optional weekly collection schedule, a state, and optionally an assignee for the current collection.

## States and transitions

```text
EMPTY ──▶ AVAILABLE ──▶ ALMOST_FULL ──▶ FULL ──▶ COLLECTION_REQUIRED
  ▲            ▲              │            │              │
  └────────────┴──────────────┴────────────┴──────────────┘
                    reset (reason required from FULL)
                    completion of collection (always allowed)
```

| Transition | Trigger | Notes |
| --- | --- | --- |
| `→ ALMOST_FULL` | Member taps "Almost full" | Informational; **never** creates an alert |
| `→ FULL` | Member taps "Full" | Creates/refreshes exactly one alert |
| `FULL → COLLECTION_REQUIRED` | Schedule window passed without collection (job) | Priority rises; same alert, refreshed — never duplicated |
| `→ EMPTY` (or `AVAILABLE`) | Collection completed, or explicit reset with reason | Resolves the alert with reason `COLLECTED` / `RESET` |
| Any → archived | Container archived | Open alerts resolve with `ARCHIVED` |

Illegal moves return `TRASH_INVALID_TRANSITION`. Nothing in the system changes a bin's state on a timer alone: **a state change always has an actor or a collection completion** (I-TRASH-003). This is the hysteresis rule that stops the "almost full / full / almost full" flap that ruins trust in stateful apps.

## Alerts (delegated to the alert engine — ADR-008)

| Condition | Alert type | Default priority | Recipient |
| --- | --- | --- | --- |
| State is FULL | `TRASH_FULL` | ATTENTION (IMPORTANT if the collection window is today) | Assignee → (no assignee) house members by role → OWNER |
| Collection window opens with a non-empty bin | `TRASH_COLLECTION_DUE` | IMPORTANT | Assignee → role → OWNER |
| NO alert | ALMOST_FULL | — | — |

Rules: one alert per container (dedupe key `TRASH_FULL:container:<id>`) · never merged across containers — putting out one bin does not mean the other was emptied · an EMPTY container near its collection window does not alert (I-TRASH-005) · resolving happens on collection completion or reset, with the reason recorded.

## Collection assignment

Any member can claim ("I'll take it out") or assign to someone else; the alert re-targets and only the new assignee is notified. The page shows "Budi is taking this out Tuesday" so nobody duplicates the effort (and so nobody gets blamed for a bin someone else promised to handle).

## Schedule

Per-container weekday set (e.g. Tue + Fri) with an optional window start time ("out by 07:00"). Reminders fire relative to the household timezone, and the lead time is household-configurable (default: the evening before plus the collection morning). Changing the schedule re-evaluates on the next tick; past events are untouched.

## History

Each container shows the last 30 days of state changes and collections ("Marked full Tue 18:40 by Budi · Collected Wed 06:55 by Sari"), enough to answer "is this bin actually being emptied?". Deeper history lives in `/activity`; retention follows PRIVACY.md (24 months) and then only aggregate counts remain.

## Edge cases

1. **Two bins, one collection trip:** marking one collected does not touch the other; the household decides (each bin has its own state). Bulk "mark all collected" is intentionally not offered in v1 — it would hide the case where one bin was forgotten.
2. **Collection done but nobody taps it:** the bin stays FULL and the alert re-escalates on the schedule's next window. The honest fix is the tap, and the alert makes that cheap — not a silent auto-reset.
3. **Bin emptied but not by a scheduled collection** (member took it to a friend's bin): "Reset with reason: emptied elsewhere" — resolves the alert, records the truth.
4. **New container mid-week:** it starts in `AVAILABLE` (not `UNKNOWN`) because bins don't need history to be meaningful.
5. **Schedule changed on collection day:** the next evaluation uses the new schedule; if the new schedule removes today, the reminder goes away and the bin's state is unchanged.
6. **Away for two weeks:** the alert escalates once, then stays visible without repeating (escalation is bounded); the household can snooze it or mark it collected when it actually happens.
7. **Hazardous/bulky items:** the kind is informational and can drive a note ("special pickup — call the office"); HomeOps does not schedule municipal services.

## Accessibility

State changes are announced with the container name and the new state; the three quick actions are labelled by outcome ("Mark kitchen bin full") and never by icon alone; the schedule is expressed in words ("Tuesdays and Fridays"), not abbreviations. See T-TRASH-* accessibility assertions and ACCESSIBILITY.md §6.

## Deliberately absent

Smart-bin sensors, weight/volume estimation, "how full is it, really?" sliders, pickup-service integrations, and gamified "who takes out the trash most" statistics. Also absent: alerts for `ALMOST_FULL` — a half-full bin is not a problem, and treating it as one is exactly the alert fatigue this design exists to avoid.
