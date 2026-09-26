# Product Spec — Rooms

> Requirements: FR-ROOM-001..008 · ADR: ADR-010 (status derivation — the decision that shapes everything here) · Design: docs/design/PAGES.md §2, DESIGN.md §13 · Tasks: T-ROOM-001..010

## Purpose

A room is the household's unit of "where things are". HomeOps does not measure rooms; it reports **what state a room appears to be in, and why** — from evidence the household already produces (work planned, work done, people's corrections).

## Explicit non-goal: no cleanliness score

There is no percentage, no 1–10 rating, no "cleanliness index", and no historical graph of a room's "condition". Rooms have a **status word** with a reason. ADR-010 rejected scoring because it invents precision, invites comparison between people, and rots quickly. Everything below follows from that.

## Room fields

| Field | Required | Notes |
| --- | --- | --- |
| Name | yes | 1–40 chars, unique case-insensitively within the household |
| Group / area | no | Free label ("upstairs", "outside"); used for grouping in lists |
| Sort order | no | Explicit ordering; reordering uses buttons, not drag-only |
| Not in use | no | Excluded from status, alerts, and the dashboard |
| Notes | no | 200 chars, optional (e.g. "spare key in the drawer") |
| Archived | no | Retained for history; hidden from pickers |

Soft cap: 50 rooms (a nudge, not a wall).

## Status vocabulary

| Status | Meaning | Typical evidence |
| --- | --- | --- |
| `CLEAN` | Recently handled, nothing due | Completion of a room-scoped chore, or an active override |
| `NEEDS_ATTENTION` | Something is due today | A room-scoped occurrence due in the household day |
| `DIRTY` | Something is overdue | A room-scoped occurrence past its due date |
| `CLEANING` | Someone is on it | An occurrence in `IN_PROGRESS` |
| `UNKNOWN` | No basis to say anything | No completed room-scoped work and no due work |

`UNKNOWN` is a first-class, honest state — not a failure. A room nobody has set up chores for is not "dirty"; it simply has no signal.

## Derivation rules (ordered, first match wins)

1. **Active override** → the override's status (with attribution and expiry).
2. **Any room-scoped occurrence `IN_PROGRESS`** → `CLEANING`.
3. **Any room-scoped occurrence overdue** → `DIRTY` (the reason names the chore).
4. **Any room-scoped occurrence due today** → `NEEDS_ATTENTION`.
5. **Most recent room-scoped completion within the recency window (default 7 days)** → `CLEAN`.
6. **Otherwise** → `UNKNOWN`.

Rules 2–4 consider only open occurrences of active definitions in active rooms. Rooms marked not-in-use or archived are excluded entirely (I-ROOM-004). The function is pure: same inputs (occurrences, completions, overrides, clock, timezone) always produce the same status.

## Manual override

People know things the system doesn't ("the kitchen is messy because we're cooking for guests"). An override:

- has a **status** and a **reason** (one tap: Cooking · Guests · Just cleaned · Other+note),
- has an **expiry**: 3 h · Tonight · Until tomorrow · Custom (bounded by a household maximum, default end of the household day; hard cap 7 days),
- is **attributed** ("set by Budi, 2 h ago") — visible to everyone, deliberately not anonymous,
- is replaced (not stacked) by a newer override from any member,
- expires automatically via the scheduler sweep; an expired override is inert even before the sweep runs (I-ROOM-001),
- can be cleared manually at any time.

## Room detail: "why is this flagged?"

Every status on a room shows its evidence in one line, e.g.:

- `DIRTY` → "Deep clean is 2 days overdue · assigned to Budi"
- `NEEDS_ATTENTION` → "Bathroom wipe-down is due today"
- `CLEANING` → "Budi started 20 minutes ago"
- `CLEAN` → "Wiped down yesterday by Sari"
- `UNKNOWN` → "No chores scheduled for this room yet — add one?"
- overridden → "Marked DIRTY by Budi (guests) — until tomorrow"

This surface exists to prevent the "the app is wrong" feeling that kills trust in household tools.

## Archival

Archiving requires handling open work: reassign the open occurrences to another room, or detach them ("no room"), or cancel them. History is preserved and the room remains readable. Archived rooms appear only in a collapsed section and in history.

## Dashboard interaction

Only rooms that need attention appear on `/today`: `DIRTY`, `NEEDS_ATTENTION`, and `CLEANING`. `CLEAN` rooms appear as a positive count if anything, and `UNKNOWN` rooms are excluded with a one-time gentle hint to add chores. Room status **never generates an alert of its own** (ADR-010) — alerts come from the underlying due/overdue work, so there is exactly one reason to act.

## Edge cases

1. **Room with two chores, one overdue and one due today** → `DIRTY` wins; the reason lists the overdue one first, with a "+1 more".
2. **Room with only ad-hoc work** → ad-hoc occurrences do count for derived status (they are real work), but a room whose only history is ad-hoc show `UNKNOWN` once they are resolved.
3. **Override during an emergency clean-up** → override wins over `CLEANING`; the UI shows "overridden by Budi" so nobody is confused about a chore still running.
4. **Deleting a room** → not offered; archiving is the only path (history integrity).
5. **Renaming a room** → chores and history keep working; activity entries store the name as it was at the time (I-ACT-004).
6. **Not-in-use toggle mid-week** → the room vanishes from the dashboard immediately; its chores remain but stop producing room signals; toggling back restores the derived status instantly (no data was destroyed).
7. **Room-scoped chore paused** → its occurrence is cancelled; the room's status re-derives with the remaining evidence (possibly `UNKNOWN` again, which is honest).

## Accessibility notes

The status is announced as words with its reason (never colour or shape alone); the override control is a keyboard-operable radio group with a length picker; "why is this flagged?" is real text in the DOM, not a tooltip. See ACCESSIBILITY.md §6 and T-ROOM-010.

## Deliberately absent

Photo-based condition assessment, "last cleaned" charts, per-room workload statistics, room-level scores, geofenced "who's home" detection, and cleanliness predictions. Also absent: a "cleaning session" concept — a member cleaning three rooms is three completions, not a logged session with a timer.
