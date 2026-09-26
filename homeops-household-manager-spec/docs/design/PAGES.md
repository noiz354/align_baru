# Page Catalogue

> One block per route: purpose, primary action, content order, states, requirements, and tasks.
> Routes follow ARCHITECTURE.md §9. `(household)` is a route group requiring an authenticated membership; `(auth)` is the public group.

## Route map

```text
(public)   /                     → redirects to /today or /sign-in
(auth)     /sign-in  /sign-up  /invite/[token]  /reset-password  /reset/[token]
(auth)     /onboarding           → create household, first room, starter resources
(household)/
  /today                  dashboard (default landing)
  /rooms                  /rooms/[id]
  /chores                 /chores/[id]   /chores/new
  /resources              (supplies + shopping + detail sheet for /resources/[id])
  /maintenance            /maintenance/[id]  /maintenance/new
  /trash                  (one page: containers + history)
  /issues                 /issues/[id]   /issues/new
  /alerts                 /alerts/[id]   (detail sheet with why-this-alert)
  /activity               (history browser)
  /more                   (hub: settings, members, maintenance links)
  /settings/{household,members,notifications,resources,alerts,data}
/offline                  (PWA fallback)
```

Navigation: bottom nav with ≤ 5 items — **Today · Rooms · Chores · Alerts · More** (Alerts shows a count badge; "More" holds Maintenance, Trash, Issues, Activity, Settings). Everything reachable in ≤ 2 taps from `/today`.

---

## 1. `/today` — Dashboard

- **Purpose:** answer "what needs attention right now?" in one screen, in a fixed order.
- **Primary action:** the most urgent quick action available; never more than 3 quick actions.
- **Content order (fixed, DP-6):** 1 attention strip (IMPORTANT/URGENT alerts) → 2 due today → 3 overdue → 4 quick actions → 5 room status → 6 low resources → 7 maintenance & upcoming → 8 recent activity.
- **States:** all-clear (explicit, friendly, no upsell) · onboarding (no data yet → one action) · stale (offline banner) · degraded (no push: silent).
- **Rules:** hide empty sections rather than showing zeroes; counts match the nav badges; no charts; no member rankings; the attention strip never collapses URGENT items.
- **Requirements:** FR-DASH-001..006 · Tasks T-DASH-001..008 · Doc docs/product/DASHBOARD.md · QA-13.

## 2. `/rooms` and `/rooms/[id]`

- **Purpose:** see which rooms need attention and why; correct reality with an override.
- **List:** grouped by floor/area when groups exist, otherwise by status; each row = name, status badge (word+shape+colour), one-line reason, and (when relevant) the chore name.
- **Detail:** status + reason at the top, "why is this flagged?" explanation, related chores with due dates, last cleaned, override control, history (collapsed after 5), archive (role-gated).
- **Empty:** "No rooms yet — add the ones you actually clean."
- **Requirements:** FR-ROOM-001..008 · T-ROOM-001..010 · Docs docs/product/ROOMS.md · QA-03.

## 3. `/chores`, `/chores/[id]`, `/chores/new`

- **List:** sections: Overdue → Today → This week → Later → Paused/Archived (collapsed). Each row: title, room, assignee initials, due (relative + absolute on tap), status badge. Filters persist in the URL.
- **Detail:** frequency summary in words ("Every 2 weeks, Fridays"), next due, assignee, history of completions/skips/snoozes, definition actions (edit/pause/archive), reopen affordance.
- **New/edit:** title → room → who → how often (the recurring builder) → save. Everything except title has a sensible default; the builder previews the next three dates.
- **Empty:** "Nothing to do — nice." / never-set-up: "Add the first chore".
- **Requirements:** FR-CHORE-001..020 · T-CHORE-001..020 · Docs docs/product/CHORES.md, RECURRENCE.md · QA-04, QA-05.

## 4. `/trash`

- **Purpose:** one page for every bin: state, next collection, who's on it.
- **Content:** per-container card with state badge, schedule ("collected Tuesdays and Fridays"), assignee, and three one-tap actions (Almost full / Full / Collected).
- **Rules:** no alerts for ALMOST_FULL; FULL shows the alert link; history collapsed (30 days visible, deeper history in activity).
- **Empty:** "No bins yet — add the ones you put out."
- **Requirements:** FR-TRASH-001..009 · T-TRASH-001..010 · Docs docs/product/TRASH.md · QA-06.

## 5. `/resources` (supplies + shopping)

- **Purpose:** know what's running low without counting anything; keep the shopping list in one place.
- **Content:** low/critical items first, then everything else grouped by category; shopping section pinned to the top when it has items, otherwise a collapsed link.
- **Detail (sheet/page):** level, mode-appropriate picker, thresholds in words ("tells us when 3 or fewer left"), history, archive.
- **Rules:** level picker instead of number entry for approximate items; "used one" always visible for counted items; restock is one tap; the shopping list copies as plain text.
- **Requirements:** FR-RES-001..012, FR-SHOP-001..004 · T-RES-001..020, T-SHOP-001..004 · Docs docs/product/RESOURCES.md · QA-07.

## 6. `/maintenance`, `/maintenance/[id]`, `/maintenance/new`

- **Purpose:** remember the things that break if forgotten — without becoming a CMMS.
- **List:** Due/overdue → Upcoming (next 30 days, ordered) → Paused/Archived (collapsed). Each row: asset/plan name, next date, assignee, lead time in words.
- **Detail:** plan facts, frequency in words, vendor note, **Record service** as the primary action, history (newest first), pause/resume, edit, linked issues.
- **Record service sheet:** three inputs maximum (date, who, short note) with "external / someone came" as an option; backdating shows the recomputed next date immediately.
- **Rules:** informational styling for upcoming (no alarm colours), no cost totals anywhere, no parts inventory.
- **Requirements:** FR-MNT-001..011 · T-MNT-001..016 · Docs docs/product/MAINTENANCE.md · QA-10.

## 7. `/issues`, `/issues/[id]`, `/issues/new`

- **Purpose:** report what's wrong in under 20 seconds; keep the record honest until it's fixed.
- **List:** open first (severity then age), then resolved/closed collapsed. Each row: title, status badge, severity, assignee, age.
- **Detail:** status + primary next action at the top (Acknowledge → Start → Resolve → Close), description, photos, comments (append-only), linked maintenance, history.
- **New:** title (the only required field) → optional photo → optional room/asset → severity default NORMAL → Report. Failure to upload a photo never blocks the report.
- **Empty:** "Nothing's broken right now."
- **Requirements:** FR-ISSUE-001..009 · T-ISSUE-001..010 · Docs docs/product/ISSUES.md · QA-09.

## 8. `/alerts`, `/alerts/[id]`

- **Purpose:** the household's attention queue — the *only* place where problems accumulate visibly.
- **List:** URGENT → IMPORTANT → ATTENTION → INFO; acknowledged/snoozed shown in place with their state (never hidden); resolved collapsed with reason. Each row: type icon, title, entity link, recipient, age, inline actions (Acknowledge, Snooze, Resolve).
- **Detail (why-this-alert):** what happened, why it matters, who's responsible, what to do, when it started, transition history, and who acted.
- **Rules:** one alert per problem (dedupe); no broadcast; snooze is bounded; resolving requires a reason when manual; counts only include OPEN IMPORTANT/URGENT for the nav badge.
- **Requirements:** FR-ALERT-001..014 · T-ALERT-001..035 · Docs docs/product/ALERTS.md · QA-11, QA-12.

## 9. `/activity`

- **Purpose:** non-surveillance history: what happened, who did it, when.
- **Content:** reverse-chronological feed grouped by day, filters (type, member, room, date range ≤ 180 days), keyset "load more".
- **Rules:** actions only — never views, never presence, never per-member totals; each row links to the entity; free-text notes are never in the feed.
- **Requirements:** FR-ACT-001..006 · T-ACT-001..006 · Docs docs/product/ACTIVITY.md · QA-08.

## 10. `/settings/*`

| Page | Content | Who can change |
| --- | --- | --- |
| `/settings/household` | Name, timezone (with "today" preview), quiet hours, alert policy, resource defaults | OWNER/ADMIN |
| `/settings/members` | Member list with roles; invite; pending invitations; per-member actions (role, remove, revoke sessions) | OWNER/ADMIN (VIEW: all) |
| `/settings/notifications` | Per-type channel matrix, quiet hours, daily cap, devices, permission state, test notification | self |
| `/settings/resources` | Threshold defaults, mode explanations, "which items are low right now" preview | OWNER/ADMIN |
| `/settings/alerts` | Escalation delay, snooze maximum, INFO expiry, per-type delivery toggles | OWNER/ADMIN |
| `/settings/data` | Export, retention windows (read-only display), request deletion, audit entries about you | OWNER (export/deletion), all (view) |

Requirements: FR-SET-001..006 · T-HH-*, T-MEM-*, T-NOTIF-004, T-RES-015, T-ALERT-035, T-PRIV-003.

## 11. Auth pages

| Route | Content | Notes |
| --- | --- | --- |
| `/sign-in` | Email + password, "forgot password" | Rate limited; generic failure copy (no account enumeration) |
| `/sign-up` | Email + password + display name | Creates a user, not a household; next step is onboarding or accepting an invite |
| `/invite/[token]` | Household name, inviter, role being offered, accept/decline | Token single-use, 7-day expiry, revocable |
| `/reset-password`, `/reset/[token]` | Request + set new password | Single-use, 30-minute expiry; revokes other sessions |
| `/onboarding` | 3 steps: household (name+timezone) → first rooms → starter supplies (skippable) | Never blocks on optional steps |

Requirements: FR-AUTH-001..008, FR-MEM-001..003, FR-HH-001..004 · T-AUTH-*, T-MEM-*, T-HH-* · QA-01, QA-02.

## 12. PWA surfaces

| Surface | Content | Notes |
| --- | --- | --- |
| `/offline` | "You're offline" + retry + what still works (read-only last view) | Served by the service worker (ADR-014) |
| Staleness banner | "Last updated 12 min ago" with refresh | Shown on cached `/today` when offline |
| Update prompt | "HomeOps updated — reload" | Never a silent swap mid-session |
| Install guidance | Contextual, after the second session; never on first load | iOS shows Share → Add to Home Screen |

Requirements: FR-PWA-001..003 · T-PWA-001..006 · Docs ADR-014 · QA-14.

## 13. Cross-page rules

1. **One primary action per screen.** Secondary actions live in an overflow menu.
2. **Every list can be empty, loading, stale, and error** — all four states are designed, not just the happy path.
3. **Counts in the nav are server-rendered** and identical to the section counts on the same screen.
4. **Deep links:** every entity has a stable URL; alerts and notifications link directly to the action, not to a home page.
5. **No dead ends:** every page has a way back and a suggested next step.
6. **Back-button honesty:** filters and tabs are URL state, so the browser back button does what people expect.
7. **Nothing scrolls horizontally** at 320 px width except tables we chose not to build.
