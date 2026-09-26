# Product Spec — Activity History

> Requirements: FR-ACT-001..006 · ADR: ADR-005 (activity as its own module) · Design: docs/design/PAGES.md §9, DESIGN.md §5/§9 · Tasks: T-ACT-001..006, T-ACT-004 (retention)

## Purpose

Answer "who did that, and when?" without turning the household into a monitored workplace. Activity history exists to **reduce repeated questions and duplicated effort**, not to measure people.

## What is recorded

| Category | Examples |
| --- | --- |
| Chores | created, edited, paused, resumed, archived, occurrence completed, skipped, snoozed, reassigned, reopened |
| Rooms | created, renamed, archived, not-in-use toggled, status override set/expired/cleared |
| Trash | state changed, collection assigned, collection completed, reset with reason |
| Resources | created, level changed, threshold crossed, restocked, mode changed, archived |
| Shopping | item added, removed, bought (linked to which resource) |
| Maintenance | asset/plan created, updated, paused, resumed, service recorded, issue linked |
| Issues | reported, acknowledged, progressed, resolved, closed, wont-fix, commented |
| Alerts | opened, acknowledged, snoozed, escalated, resolved, expired |
| Household | member invited, joined, role changed, removed, settings changed, ownership transferred |

## What is never recorded (hard rule)

| Not recorded | Why |
| --- | --- |
| Views, opens, "last seen", reading of any screen | Surveillance; destroys trust (PRIVACY.md PP-9) |
| Per-member completion counts or rankings (no such query exists) | Turns a home into a leaderboard (DESIGN.md §18) |
| Location, device, IP, or presence | Not needed; would be creepy |
| Free-text notes or comment bodies | They belong to their entities, not to a feed |
| Notification delivery history per member (beyond the alert's own transitions) | Delivery is machinery; the alert is the fact |

A test asserts the absence of view/presence event types and of any per-member counting read model (T-ACT-006) — absence must be enforced, not merely intended.

## Entry shape

An entry has: type, actor (member or "system"/"job"), timestamp, entity reference (type + id), a **title snapshot** captured at write time ("Deep clean", "Kitchen bin"), optional bounded metadata (ids, enums, counts), and a retention stamp. Titles are snapshots so history remains readable after a rename or archive (I-ACT-004) — and so the feed never has to join live tables.

## Presentation

- `/activity` groups entries by day, newest first, with a human sentence: "Budi completed Deep clean in Bathroom · 08:14".
- Filters: type, member, room, date range (≤ 180 days); filters live in the URL so the back button behaves.
- Pagination: keyset "load more" (never infinite scroll — people lose their place).
- Entity pages show a compact activity section (last 5, expandable) rather than duplicating the whole feed.
- Relative time with the absolute value on tap ("2 h ago" → "today 08:14").

## Retention

Default **12 months**, household-configurable between 3 and 24. A nightly job prunes in batches and logs counts only (no per-entry logging). After pruning, older history is gone — the household can export before that, and the export includes activity. Retention is enforced by the job, not by convention (I-ACT-005), and the schedule is documented in PRIVACY.md §3.

## Relationship to other logs

| Artifact | Audience | Content | Lifetime |
| --- | --- | --- | --- |
| Activity history | household members | product facts, readable sentences | 12 months (configurable) |
| Alert transitions | household members (via the alert) | state changes of an alert | with the alert (24 months) |
| Audit log | operators (rarely) | role/auth/export/delete events | 24 months |
| Application logs | operators | ids, codes, durations — never content | 30 days |

They are deliberately separate: a member never sees operator logs, and an operator never needs household narration.

## Edge cases

1. **A member is removed:** their historical entries remain, attributed to "former member" (ids are retained for referential integrity, the display name is snapshotted). Their history does not vanish — deleting it would falsify the record.
2. **An entity is archived or deleted:** entries remain, using snapshotted titles; links degrade to a read-only view or are rendered as plain text.
3. **A job performs an action** (materialisation, expiry, escalation): actor is `system`, and the entry says what happened without implying a person did it.
4. **Bulk operations** (retention prune, archive cascade): recorded as a single entry with a count, never one entry per row.
5. **Clock/timezone:** timestamps are stored in UTC and displayed in the household timezone; day grouping follows the household day, not UTC.
6. **Export:** includes activity entries within the retention window, in the export archive (T-PRIV-003).

## Deliberately absent

Presence, "Budi is online", typing indicators, read receipts, streak counters, per-member dashboards, contribution charts, weekly summary emails about who did what, and any AI-generated judgement ("Budi has been slacking"). If a household wants accountability, the honest mechanism is a conversation — not a feed.
