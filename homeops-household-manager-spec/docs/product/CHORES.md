# Product Spec — Chores

> Requirements: FR-CHORE-001..020 · Recurrence detail in docs/product/RECURRENCE.md · Design: DESIGN.md §7/§13/§17, docs/design/PAGES.md §3 · Tasks: T-CHORE-001..026 · ADRs: ADR-006 (occurrence model), ADR-007 (recurrence), ADR-008 (alerts)

## Purpose

Make recurring housework visible, assignable, and finishable in one tap — and make the *history* trustworthy enough that nobody argues about whether the bathroom was cleaned.

## The two-entity model (important)

HomeOps separates:

- **ChoreDefinition** — the intention: title, room, who, how often, priority. Edited rarely.
- **ChoreOccurrence** — the instance that must be done: due date, status, who did it, when.

Consequences members feel: editing a chore's schedule **never rewrites the past**; completing today's instance never touches next week's plan; an occurrence that persists unresolved is visible as overdue rather than silently replaced (that is the whole point).

## Creation

| Field | Required | Default | Notes |
| --- | --- | --- | --- |
| Title | yes | — | 1–80 chars, plain text |
| Room | no | none | "No room" is legitimate (e.g. "take out recycling bins") |
| Assignee | no | none (household pool) | Default assignee is used at materialisation time |
| Repeat | yes (defaults to "One-off") | One-off | Builder in RECURRENCE.md |
| Priority | no | NORMAL | LOW / NORMAL / HIGH — influences alert priority, not urgency by itself |
| Notes | no | — | 200 chars, visible on the chore, never in notifications |
| Estimated duration | no | — | A hint for "quick wins" only; never aggregated per member |

## Occurrence statuses

| Status | Meaning | Shown as |
| --- | --- | --- |
| `SCHEDULED` | Waiting | "Due Friday" |
| `IN_PROGRESS` | Someone started | "Budi is on it" |
| `DONE` | Completed (records actor/time) | "Done yesterday by Budi" |
| `SKIPPED` | Deliberately not done (reason recorded) | "Skipped — away this week" |
| `SNOOZED` | Deferred to a specific time | "Back tomorrow morning" |
| `CANCELLED` | No longer applicable (definition archived/paused) | "Cancelled" |

Exactly one occurrence per definition is *open* at a time (`SCHEDULED`, `IN_PROGRESS`, `SNOOZED`). This is enforced by a database constraint, not a convention (I-CHORE-001).

## Completion

- One tap from the dashboard, the chore list, or the chore detail page.
- Records who completed it and when; optional note (≤ 500 chars) and optional photo (VS-11).
- Idempotent: double-taps, retries or a stale tab cannot create two completions.
- Effects: resolves the chore's alerts with reason `COMPLETED` · feeds room status · writes an activity entry · for completion-anchored recurrence, sets the anchor for the next date · materialises the next occurrence on the following tick.
- Undo is available for 8 seconds (the compensating action is a reopen, recorded honestly in history).

## Skip

A skip means "this one didn't need doing". It requires a one-tap reason (Away · Not needed · Something came up · Other+note). Effects: resolves alerts with `SKIPPED` · does **not** advance a completion-anchored series (the next date still depends on the last completion) · the occurrence stays in history and is excluded from overdue counts.

## Snooze

Defer without pretending it's done. Bounded by a household maximum (default: tomorrow, max 7 days) with chips (1 h · Tonight · Tomorrow · Weekend · custom). Effects: alert suppressed until `snoozedUntil`, then re-evaluated by the next tick · the occurrence remains visible with its state. Snoozing is a *promise*, so it is attributed.

## Reassignment

Claim (self-assign) is always one tap. Assigning to someone else is allowed for any member (real households help each other) and notifies **only** the new assignee. Reassignment re-targets future alerts but never re-sends history. Assigning a completed occurrence is rejected.

## Definition lifecycle

| Action | Effect | Who |
| --- | --- | --- |
| Edit | Applies to future occurrences; the open occurrence gets a "definition changed" note | creator/assignee/ADMIN |
| Pause | No new occurrences; open one resolves alerts with `PAUSED` | creator/assignee/ADMIN |
| Resume | Next date recomputed from the rule anchor (not from the pause date) | same |
| Archive | History retained, hidden from lists, no future occurrences; open occurrence must be resolved first (cancel or complete) | ADMIN/OWNER |

## Room interaction

A room-scoped chore drives the room's derived status (ADR-010): in-progress → CLEANING; overdue → DIRTY; due today → NEEDS_ATTENTION; completed → CLEAN. Chores without a room have no room effect. Archiving a room forces a decision about its open occurrences (I-ROOM-004) — never silent deletion of work.

## Ad-hoc work

"Add something for today" creates a single occurrence with no definition (`source = AD_HOC`): title, optional room, optional assignee, optional due date. It behaves exactly like a scheduled occurrence, is not part of any recurrence, and shows in the same lists. Converting ad-hoc work into a repeating chore is deliberately out of scope for v1.

## Edge cases

1. **Missed ticks:** if the scheduler was down for two days, materialisation catches up to *one* open occurrence (never a backlog of shame).
2. **Rule edited while an occurrence is open:** the open occurrence keeps its due date unless the member explicitly chooses "apply to this one too" (T-CHORE-013).
3. **Completion during an outage:** impossible — completion requires the server (ADR-014); the UI says so clearly rather than pretending.
4. **Two members complete at once:** one wins; the other sees "already completed by …" and no data is lost.
5. **Reopening after 24 h:** restricted to ADMIN/OWNER to keep history meaningful.
6. **A chore whose room is archived:** the occurrence survives with a "no room" marker.
7. **Helper rights:** HELPER can complete and skip their own assigned work, cannot snooze or reassign (AUTHZ-MATRIX §4).

## Deliberately absent

Points, streaks, per-member completion counts, a "chore chart" with rewards, photo proof requirements, time tracking, gamified badges, and AI suggestions of what to clean next. Chores in HomeOps exist to be done, not to be scored (DESIGN.md §18).
