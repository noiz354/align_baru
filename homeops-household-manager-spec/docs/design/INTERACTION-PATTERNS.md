# Interaction Patterns

> The recurring recipes. If a screen does something twice, it is here — with the reasoning and the failure modes.
> Each pattern lists: when to use it, the recipe, the accessibility contract (ACCESSIBILITY.md IDs), and its task.

## 1. One-tap action with undo (the core pattern)

**Use for:** complete chore, mark trash full, used one, restock, mark bought, complete collection.
**Recipe:** tap → optimistic update (row changes immediately, marked "saving…" subtly) → server confirms in ~200 ms → toast "Done · Undo" for 8 s → undo reverses with a compensating call carrying the same `clientRequestId` semantics.
**Failure:** if the server rejects, the row reverts with a short inline reason and keeps the member's context (no page reload).
**Rules:** never more than 3 one-tap actions on a screen · no confirmation dialog for reversible actions · no confirmation dialog for one-tap actions at all (undo *is* the confirmation) · the button says the outcome ("Mark collected", not "Submit").
**Accessibility:** `A-*` — announcement via `role="status"` after completion; the toast is reachable by keyboard without grabbing focus unexpectedly; undo is a real button with 44 px target.

## 2. Quick actions row (dashboard)

**Use for:** the 2–4 things a member is most likely to do right now, derived from live state.
**Recipe:** the row is computed server-side; it only contains actions that are currently valid; if nothing is valid, the row disappears entirely (and the dashboard says why in the all-clear state).
**Rules:** no configuration UI for this row (it is opinionated by design, DP-6) · order: unblock-others first (trash collection), then "used one" for a critical item, then assigned work, then report-an-issue.
**Failure:** stale row → the action returns `CONFLICT`/`OCCURRENCE_NOT_OPEN` → the row refreshes itself with an explanatory toast.

## 3. Level picker (supplies)

**Use for:** any `APPROXIMATE` or binary resource, or an at-a-glance EXACT adjustment.
**Recipe:** segmented chips in one row — EXACT: `[Used one] [Set to target]`; APPROXIMATE: `[Full] [Enough] [Low] [Empty]`; binary: `[Available] [None]`. Current level shown as a status badge above.
**Rules:** no sliders (imprecise, hard to operate one-handed, poor for screen readers) · no free numeric typing required (EXACT offers a small number stepper as a secondary path) · the chosen chip reflects instantly.
**Failure:** `RESOURCE_MODE_MISMATCH` → the picker explains the mode rather than showing a raw error.
**Accessibility:** `A-K3` — keyboard arrow navigation inside the chip group; the group is a labelled single control; the announcement names the item ("Toilet paper: low").

## 4. Snooze / defer picker

**Use for:** chore snooze, alert snooze, maintenance "not yet".
**Recipe:** chips `1 h · Tonight · Tomorrow · Weekend` (+ custom, bounded by the household maximum). The chosen time is shown as a sentence: "Back tomorrow at 8:00 am".
**Rules:** never a free-text date input · the picker shows the maximum allowed when the member pushes against it · snoozing never *resolves* anything (the item remains visible with its state).
**Failure:** `SNOOZE_TOO_LONG` → copy suggests pausing the chore instead.
**Accessibility:** `A-*` — the computed time is announced, not just the chip label; DST boundaries show the real wall-clock time.

## 5. Reason picker (skip, reset, resolve, wont-fix)

**Use for:** any action that removes information from the household's view.
**Recipe:** enum chips (pre-filled with the common cases) + optional 140-char note. One tap is enough to proceed.
**Rules:** a reason is required, but never a paragraph — the goal is coherence, not accountability theater · the note is never used for scoring or shown in notifications · reasons appear in the activity history next to the action.
**Accessibility:** chips are a radio group with a visible legend; the note field is optional and clearly labelled as such.

## 6. Optimistic list updates & live counts

**Use for:** lists where an action changes the row's group (chore completed leaves "Overdue").
**Recipe:** move the row with a 150 ms transition (removed under reduced-motion), update the section counts locally, reconcile after the server responds; if the server disagrees, the list re-renders from truth with a quiet toast.
**Rules:** never animate more than one row per action · never reorder the whole list under the member's finger · counts never change before the row does.

## 7. Conflict handling (two people, one task)

**Use for:** any mutation on a row another member may have changed seconds ago.
**Recipe:** server returns `CONFLICT` or `OCCURRENCE_STALE` with the current state → the UI refreshes that row, keeps the rest of the page intact, and shows "Budi just completed this" (task-first attribution, no blame copy).
**Rules:** never silently overwrite ("last write wins" is a data-loss bug in a shared household) · never a modal alert for this; it is routine · the member's typed input elsewhere on the page is preserved.

## 8. Empty, all-clear, and onboarding states

| Situation | Pattern |
| --- | --- |
| Nothing due, nothing wrong | All-clear: "You're all clear today." + a single low-key suggestion (e.g. a maintenance item due next week) |
| Nothing configured yet | Onboarding nudge with exactly one action and a rationale ("Add your first room — chores need a home") |
| A section has no items | Section hidden (never a zero-count card) |
| Nothing in the shopping list | "Nothing to buy." |
| No alerts ever | "No alerts. That's the goal." (honest, not gamified) |

## 9. Error surfaces (E-1..E-7 mapping)

| Class | Surface | Copy shape | Recovery |
| --- | --- | --- | --- |
| E-1 network/unreachable | Inline banner + retry button | "We couldn't reach HomeOps." | Retry; work stays on screen |
| E-2 validation | Field-level inline | "That amount doesn't look right." | Fix in place |
| E-3 permission | Page banner naming who can act | "Only owners and admins can change the timezone." | Ask the right person (with a shareable hint) |
| E-4 conflict/stale | Toast + row refresh | "Someone changed this a moment ago." | Continue with fresh data |
| E-5 rate limited | Toast | "That's a lot at once — try again in a minute." | Wait; no threshold disclosure |
| E-6 offline/stale data | Persistent banner with last-updated time | "Last updated 12 min ago." | Refresh when online |
| E-7 unexpected (500) | Page-level with a short reference id | "Something broke on our side. Reference 7f2a." | Retry; report if persistent |

## 10. Confirmation & destructive actions

**Two-tier model:** reversible → do it, offer undo; irreversible or data-losing → confirm, and the dialog names the consequence in the same words as the activity feed later will ("Archiving this room keeps its history; its chores will no longer be scheduled").
**Rules:** never double-confirm · never a confirm dialog that can be dismissed accidentally into the destructive path (the safe option is the default focus) · destructive buttons are never adjacent to the primary action without spacing.

## 11. Notifications that earn their place

**Recipe:** every notification (a) names the thing, (b) says why it matters, (c) offers the next action as a deep link, (d) can be turned off by type — while the in-app alert always remains.
**Rules:** grouped/low-priority items collapse into one digest; URGENT items are never grouped; lock-screen text is minimal by default (PRIVACY.md §8); no notification may contain free text written by another member.

## 12. Forms with defaults

**Recipe:** every create form has at most one required field; the rest are pre-filled from household defaults and the member's last choice; the form remembers scope (the room they were browsing) and says so.
**Rules:** no multi-step wizards except onboarding and the recurrence builder · save-on-submit only (no autosave that can surprise) · the back button never loses input without asking.
**Accessibility:** `A-F*` — errors announced at submit, focus moves to the first invalid field, and the error summary lists every problem in one place.

## 13. Offline behaviour

**Recipe:** offline is **read-only and clearly labelled**. The service worker serves the shell and the last rendered `/today` with a staleness banner. Any mutation fails immediately with E-1 copy and a retry affordance; nothing is queued (ADR-014: no background sync, no conflict-prone offline writes).
**Rules:** never show a cached list as if it were live · never silently drop a tap · the offline page explains what still works.

## 14. Interaction anti-patterns (do not build)

| Anti-pattern | Why it is banned |
| --- | --- |
| Long-press-only actions | Undiscoverable and inaccessible |
| Drag-to-reorder as the only path | Provide buttons instead (rooms, chores) |
| Infinite scroll in history | Users lose their place; use "load more" |
| Badge counts that include INFO alerts | Trains people to ignore the badge |
| Streaks, points, "household health %" | Turns a home into a scoreboard (DESIGN.md §18) |
| Auto-dismissing error messages | The member may have looked away |
| Modal-on-modal | Escape hatch: use a sheet with a back action |
| Toast-only errors for failed writes | Failures must be visible in-place where the data lives |
