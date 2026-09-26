# Product Spec — Dashboard (`/today`)

> Requirements: FR-DASH-001..006 · Design: DESIGN.md §6, docs/design/PAGES.md §1 · Tasks: T-DASH-001..008 · ADRs: ADR-006, ADR-008, ADR-010, ADR-011, ADR-012 (read models), ADR-001 (rendering)

## Purpose

Answer three questions in under five seconds: **What needs me right now? What's coming? Is everything fine?**

The dashboard is a single read model (`DashboardSnapshot`) composed in parallel from domain read functions. It is not configurable: a household with a fixed, opinionated order learns where to look and stops hunting.

## Fixed content order

| # | Section | Shown when | Hidden when |
| --- | --- | --- | --- |
| 1 | Attention strip (IMPORTANT/URGENT alerts) | any such alert is OPEN or ACKNOWLEDGED | none exist |
| 2 | Overdue | any occurrence is past its due date and unresolved | none |
| 3 | Due today | any occurrence is due in the household day | none |
| 4 | Quick actions | at least one action is currently valid | none valid (the all-clear state explains) |
| 5 | Room status | any room is DIRTY / NEEDS_ATTENTION / CLEANING | all CLEAN or UNKNOWN |
| 6 | Low supplies | any resource is LOW or CRITICAL | all stocked |
| 7 | Maintenance & upcoming | a plan is due within its lead time, or upcoming within 7 days | none |
| 8 | Recent activity | always (unless the household has no history at all) | — |

Ordering rationale: alerts first (someone may be blocked), then time-bound work, then what you can *do*, then ambient state (rooms, supplies), then forward-looking information, then social context (activity). Overdue before due-today because lateness compounds.

## Section rules

| Section | Rules |
| --- | --- |
| Attention strip | One row per alert; grouped resource alerts appear as one row that names CRITICAL items individually; URGENT is never collapsed; each row has one inline action (Acknowledge / Resolve / Open) |
| Overdue | Neutral copy, task-first ("Deep clean is 2 days overdue"), assignee shown as context not blame; supports snooze/complete inline |
| Due today | Household timezone defines "today"; snoozed items appear only after their snooze expires; IN_PROGRESS shows "Budi is on it" rather than a second prompt |
| Quick actions | Server-computed from state; ≤ 3 actions; each is idempotent and undoable |
| Room status | Only rooms needing attention; each row names the reason and the responsible chore |
| Low supplies | CRITICAL first; grouped count matches the resource alert; actions: Restock, Used one, Open list |
| Maintenance | Informational styling; "due in 5 days" not "URGENT"; deeper list at `/maintenance` |
| Recent activity | Last 5 entries; relative time; link to `/activity` |

## All-clear state

When every section is empty the dashboard says something specific and honest, e.g.:

> **You're all clear today.** Nothing is overdue, the bins are fine, and nothing's running low.
> *(Next up: filter replacement in 6 days — no rush.)*

It never manufactures work, never shows a score, and never nags. The optional "next up" line is one item at most.

## Onboarding state (no data yet)

One action: **Add your first room** (rationale: chores need a place). If rooms exist but no chores: **Add a chore**. If chores exist but nothing is due: the all-clear state. Starter supplies are suggested once, never auto-created (T-RES-019).

## Data and freshness

| Aspect | Behaviour |
| --- | --- |
| Composition | Parallel reads; no sequential waterfalls; each section has its own bound (max rows) |
| Freshness | Rendered server-side per request; no cache longer than a few seconds; after a mutation the affected sections revalidate by tag |
| Pagination | Sections show a bounded preview with a "view all" link — never infinite scroll |
| Offline | Last rendered snapshot with a staleness banner; refresh offered, never automatic |
| Performance | Section budgets in PERFORMANCE.md; the dashboard is the p95 budget holder for the app |

## Edge cases

1. **Midnight/timezone:** an occurrence due "today" at 23:59 household time stays in Due today until the household day ends, regardless of the server's UTC date.
2. **Two members acting at once:** both see the inline action; the loser gets `OCCURRENCE_STALE` and the row refreshes with "Budi just completed this".
3. **50+ overdue items:** the section shows the 5 oldest with a count and a "view all" link; it never renders an unbounded list.
4. **Away members:** their items remain visible (the household still needs the work done) but no notifications were sent to them.
5. **New member joins:** they see the same dashboard as everyone else — no personal onboarding dashboard, no "your tasks" filter by default.
6. **An alert is acknowledged but unresolved:** it stays in the strip marked "Budi is on it"; it does not disappear (that would hide responsibility).
7. **Disabled features (no push, no email):** invisible on the dashboard; those settings live in `/settings`.

## Open questions

- Whether "Upcoming" should merge maintenance and chores into a single forward-looking list after a month of real use (revisit in VS-16 review, T-DOC-005).
- Whether the attention strip needs a "show all" affordance once a household exceeds ~10 simultaneous alerts (measure first).
