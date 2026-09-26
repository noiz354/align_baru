# QA.md — Manual QA Scenarios

> 2026-09-26 · Status: **SCENARIOS SPECIFIED, NOT EXECUTED** · These are the scripts a human (or an agent with a browser) runs before a slice is declared done.
> Format per scenario: **ID · viewport · precondition · steps · expected · edge cases · requirements · task**.
> Viewports: **M** = 375×667 (mobile), **T** = 768×1024 (tablet), **D** = 1280×800 (desktop). Unless stated, run on **M** first, then **D**.

## 1. How to run a QA pass

1. Start from a seeded database (`docs/testing/TEST-DATA.md`) with two households: `A` (main) and `B` (isolation checks).
2. Sign in as different roles across scenarios (Ayu=OWNER, Budi=MEMBER, Citra=HELPER).
3. Record for each scenario: pass/fail, screenshots, console errors, and any deviation from DESIGN.md.
4. Any failure becomes a task or a bug note referencing the scenario ID.
5. Accessibility mini-pass on every UI scenario: keyboard path, focus visibility, status not colour-only.

## 2. Core scenarios

### QA-01 — Create household
- **Viewport:** M, D
- **Precondition:** Signed-in user with no household; email verified.
- **Steps:** `/` → "Create household" → name "Rumah Ayu" → timezone "Asia/Jakarta" → week start Monday → Save.
- **Expected:** Redirect to `/today`; empty dashboard shows the "All clear / get started" state; creator listed as OWNER in `/settings/members`; exactly one household row created; `HouseholdCreated` in activity.
- **Edge cases:** Empty name; 61-char name; invalid timezone; double-submit; two tabs submitting simultaneously; user who already has a household (must get `HOUSEHOLD_ALREADY_EXISTS`, not a second household).
- **Requirements:** FR-HH-001, FR-HH-002, FR-HH-005, FR-HH-012 · **Task:** T-HH-001

### QA-02 — Invite and join
- **Viewport:** M
- **Precondition:** Household A exists (owner Ayu); Budi signed out.
- **Steps:** Members → Invite → role MEMBER → copy link → open in a private window → sign up as Budi → accept.
- **Expected:** Budi lands on `/today` of household A; activity shows `MemberJoinedHousehold`; invitation shows as accepted; Budi's role is MEMBER; no access to settings-level actions.
- **Edge cases:** Expired link; already-used link; revoked link; link opened by an existing member of A; accepting while signed in as a member of another household; role changed after invite but before accept (accepted role wins as documented); brute-force token guessing (rate-limited).
- **Requirements:** FR-MEM-003, FR-MEM-004, FR-INVITE-security (T-08) · **Task:** T-MEM-002

### QA-03 — Create room
- **Viewport:** M, D
- **Precondition:** Owner in household A.
- **Steps:** Rooms → Add → "Bathroom" → group "Upstairs" → reorder.
- **Expected:** Room appears with state `UNKNOWN` and explanation "No chores tracked for this room yet"; ordering persists; duplicate name rejected with a field error.
- **Edge cases:** Duplicate name differing in case/whitespace; very long name; emoji/unicode name; 50-room soft limit; archiving a room with an open chore; renaming a room that chores reference.
- **Requirements:** FR-ROOM-001, FR-ROOM-003, FR-ROOM-007 · **Task:** T-ROOM-001

### QA-04 — Create chore and complete it
- **Viewport:** M (primary), D
- **Precondition:** Room "Bathroom" exists; Ayu signed in.
- **Steps:** Chores → Add → "Clean bathroom" → room Bathroom → priority HIGH → recurrence "Every week on Friday" → save. Then go to `/today` on Friday and tap the chore's "Done" button.
- **Expected:** Dashboard shows the chore under "Due today"; one tap completes it; confirmation snackbar with Undo; occurrence marked done; activity lists `ChoreCompleted` with actor; chore detail shows next due date; room status becomes `CLEAN` (rule 5).
- **Edge cases:** Double-tap quickly (only one completion); complete from the detail page and from the dashboard simultaneously (no duplicates); complete an already-completed occurrence via stale tab (409/idempotent, friendly message); complete a chore for a room that was archived; complete with an optional note; network drop mid-action (E-1 error + retry, no partial state).
- **Requirements:** FR-CHORE-004, FR-CHORE-005, FR-CHORE-011, FR-ROOM-003 · **Task:** T-CHORE-004

### QA-05 — Skip, snooze and reassign
- **Viewport:** M
- **Precondition:** Open occurrence assigned to Budi, 2 days overdue.
- **Steps:** Chore detail → Skip (reason: "Away") → observe; then create a fresh occurrence → Snooze → "Tomorrow" → verify; then Reassign to Citra.
- **Expected:** Skip records an audit row and resolves the overdue alert with reason `SKIPPED`; the completion-anchored series does **not** advance (for AFTER_COMPLETION chores); snooze shows the new due time and no alert fires until it expires; reassignment re-targets the alert recipient and notifies only Citra.
- **Edge cases:** Snooze beyond the household maximum (rejected with clear copy); skip without a reason (rejected); reassign to an away member; reassign to a removed member; reopen a completion within/after 24 h.
- **Requirements:** FR-CHORE-007, FR-CHORE-008, FR-CHORE-009, FR-ALERT-010 · **Task:** T-CHORE-007

### QA-06 — Trash: mark full and collect
- **Viewport:** M
- **Precondition:** Container "Kitchen" state `AVAILABLE`; collection schedule Tue/Fri.
- **Steps:** `/today` → Trash card → "Almost full" → later "Full" → alert appears with "Mark collected" action → tap "Assign to Budi" → switch to Budi's session and complete collection.
- **Expected:** `ALMOST_FULL` produces no alert; `FULL` creates exactly one open alert (`TRASH_FULL:container:<id>`) targeted at the assignee with an action; collection resets state to `EMPTY`, resolves the alert automatically, and appears in activity; a second "collected" tap is idempotent; state events recorded for each transition.
- **Edge cases:** Marking full twice; collecting before full (allowed with reason); resetting from FULL manually (reason required); two containers full at once (two alerts, both individually visible); collection when the assigned member was removed; schedule window crossing midnight.
- **Requirements:** FR-TRASH-002, FR-TRASH-003, FR-TRASH-005, FR-TRASH-008 · **Task:** T-TRASH-008

### QA-07 — Resource low → restock
- **Viewport:** M
- **Precondition:** "Toilet paper" APPROXIMATE, "Rice" EXACT (5 kg, low at 2), "Drinking water" AVAILABLE_UNAVAILABLE.
- **Steps:** Set toilet paper to LOW; decrement rice to 2 (crossing threshold); toggle water to unavailable; open `/today` and the shopping list.
- **Expected:** One grouped `RESOURCE_LOW` alert listing items (not three separate notifications); CRITICAL/UNAVAILABLE items individually visible in the alert body and attention strip; shopping list shows all three with quantity hints; "Restocked" on water resolves the water contribution and the alert updates.
- **Edge cases:** Crossing thresholds repeatedly within a day (no repeated notifications); mode change resets level with confirmation; restock to target for EXACT; deleting/archiving a resource with an open need; item bought manually without a linked resource.
- **Requirements:** FR-RES-004, FR-RES-005, FR-RES-007, FR-RES-008, FR-RES-009 · **Task:** T-RES-014

### QA-08 — Cross-household isolation (security QA)
- **Viewport:** D
- **Precondition:** Households A and B with distinct rooms, chores, issues.
- **Steps:** As Ayu (A), attempt: (1) open `/rooms/<B-room-id>`; (2) save a chore with roomId from B; (3) call `completeChoreOccurrence` with B's occurrence id; (4) list activity with a crafted cursor from B; (5) request an attachment id from B.
- **Expected:** Every attempt returns `NOT_FOUND` (no existence disclosure); no data from B appears anywhere; no partial writes; the attempts appear in logs as failures **without content**.
- **Edge cases:** Guessing ids; malformed uuids; replayed Server Action payloads; a member who was removed mid-session (must be treated as unauthenticated).
- **Requirements:** NFR-SEC-001, NFR-SEC-002, T-01, T-02 · **Task:** T-SEC-002

### QA-09 — Report and resolve an issue
- **Viewport:** M
- **Precondition:** Any member (including HELPER) signed in.
- **Steps:** `/today` → "Report issue" → title "Leaking tap" → room Bathroom → severity HIGH → attach photo → submit.
- **Expected:** Completed in ≤ 20 s; issue appears with `OPEN`; HIGH severity raises an alert immediately; assign → acknowledge → in progress → resolve with a follow-up chore; alert auto-resolves with reason; transitions recorded; HELPER cannot close the issue (role rule).
- **Edge cases:** SAFETY severity creates an `URGENT` alert bypassing quiet hours; no photo (allowed); oversized/EXIF-laden photo (stripped, bounded); duplicate submissions (idempotent); comment on a closed issue (rejected with explanation); WONT_FIX without reason (rejected).
- **Requirements:** FR-ISSUE-001..009 · **Task:** T-ISSUE-002

### QA-10 — Maintenance due and service record
- **Viewport:** M, D
- **Precondition:** Asset "AC bedroom" with plan "Every 6 months", `lastServiceAt` 5 months ago, lead time 7 days.
- **Steps:** Advance the test clock to the lead window → observe the alert → complete the service with vendor "Teknisi A", cost note → verify next due.
- **Expected:** `MAINTENANCE_DUE` at the lead boundary; completing service requires ≤ 3 inputs; `nextServiceAt` recomputes with month clamping; overdue path escalates once; pausing the plan resolves the alert with `PAUSED` and stops future alerts; history shows the record.
- **Edge cases:** Service completed early; backdated service (next date shown immediately after save); frequency crossing a leap year; DST shift; household-level plan without an asset; vendor performed (`EXTERNAL`, actor null); estimated cost left blank.
- **Requirements:** FR-MNT-004, FR-MNT-005, FR-MNT-007, FR-MNT-009 · **Task:** T-MNT-005

### QA-11 — Acknowledge and snooze an alert
- **Viewport:** M
- **Precondition:** Ayu has one `IMPORTANT` chore-overdue alert and one `INFO` reminder.
- **Steps:** Acknowledge the overdue alert → verify escalation stops; snooze it for "Tonight" → verify it disappears from the attention strip but stays in `/alerts`; wait for the snooze to expire (test clock) → verify it returns.
- **Expected:** Acknowledgement shows who owns it and does not resolve it; snooze is bounded, attributed, and auto-returns; the INFO alert behaves quietly under quiet hours; the badge count reflects only `IMPORTANT`/`URGENT`.
- **Edge cases:** Snoozing beyond the maximum; snoozing an `URGENT` alert (allowed, but the recipient is told it is urgent); resolving while the condition persists (warning shown); acknowledging after auto-resolution (rejected as terminal); quiet hours across midnight and DST.
- **Requirements:** FR-ALERT-007, FR-ALERT-008, FR-ALERT-011, FR-ALERT-012 · **Task:** T-ALERT-031

### QA-12 — Notifications, caps and fatigue controls
- **Viewport:** M (device), D (settings)
- **Precondition:** Budi with push enabled on one device, email disabled; ≥ 6 low resources; cap 5/day.
- **Steps:** Trigger the grouped resource alert → verify one notification; then trigger five separate due chores in a day → verify the cap produces a digest; toggle quiet hours and verify non-urgent suppression with in-app truth intact; remove the app from the device (simulate dead subscription) and verify cleanup.
- **Expected:** No broadcast to Ayu/Citra when Budi is the assigned member; push payload minimal (no titles or notes); suppressed notifications recorded with reasons; dead subscriptions removed silently; "why did I get this?" explains the reason for each alert.
- **Edge cases:** Quiet hours + `URGENT` (must deliver); cap reached + `URGENT` (still delivered, counted); push permission denied (in-app only, no nagging); multiple devices for one member; email channel off; device timezone vs household timezone.
- **Requirements:** FR-ALERT-013, FR-NOTIF-004, FR-NOTIF-007, FR-NOTIF-010, NFR-PRIV-008 · **Task:** T-NOTIF-005

### QA-13 — Dashboard ordering and empty states
- **Viewport:** M, T, D
- **Precondition:** Household with one urgent alert, two due-today chores, one overdue, low resource, maintenance due, and recent activity.
- **Steps:** Open `/today`; collapse a card; hide a card in settings; then resolve everything and re-open.
- **Expected:** Cards appear in the documented order (Urgent → Due today → Overdue → Quick actions → Room status → Low supplies → Maintenance → Upcoming → Recent activity); empty cards are hidden; the "All clear" state appears with a useful action when nothing needs attention; ordering never shuffles between loads.
- **Edge cases:** No data at all (new household); only INFO alerts; 20 due-today items (list bounded with "view all"); a card whose section fails (E-7 partial failure, page still usable); 200% zoom; reduced motion.
- **Requirements:** FR-DASH-001..006, DESIGN §9 · **Task:** T-DASH-001

### QA-14 — PWA install, offline and staleness
- **Viewport:** M (Android Chrome + iOS Safari)
- **Precondition:** Production build over HTTPS.
- **Steps:** Install from the home screen; open offline; attempt to complete a chore offline; return online and refresh.
- **Expected:** Install prompt appears only after meaningful engagement; offline shows the shell with the staleness banner ("Last updated …") on `/today`; the offline mutation fails visibly with retry (no silent queue); online refresh shows current state; update prompt appears after a new deploy ("Updated — reload").
- **Edge cases:** iOS manual install path documented in settings; push permission requested only from settings; service worker cache version bump; stale shell after deploy; storage pressure on iOS; airplane-mode toggle mid-action.
- **Requirements:** FR-PWA-001..004, ADR-014 · **Task:** T-PWA-003

### QA-15 — Accessibility pass (per UI slice)
- **Viewport:** M, D
- **Precondition:** Any populated household.
- **Steps:** Keyboard-only pass through `/today` → complete a chore → acknowledge an alert; screen reader pass (VoiceOver/NVDA) on the same path; contrast check on status badges in light and dark; zoom to 200%; enable reduced motion; axe run.
- **Expected:** Every action reachable and operable by keyboard with visible focus; status announced as words ("Bathroom: dirty, overdue by 2 days"); live-region confirmations polite, urgent alerts assertive once; contrast ratios met; no motion required to understand state; axe clean (no new violations).
- **Edge cases:** Focus after navigation; Escape closing sheets; error summary on multi-field forms; long list announcements; screen-reader behaviour of optimistic updates; colour-blind simulation of status colours.
- **Requirements:** NFR-A11Y-001..008 · **Task:** per UI task (T-A11Y-001 as the harness)

## 3. Regression set (run every slice)

QA-03, QA-04, QA-06, QA-08, QA-11, QA-13. These cover rooms, chores, trash, isolation, alerts and the dashboard — the paths whose breakage would be most damaging.

## 4. Bug reporting template

```markdown
ID: QA-XX
Severity: S1 (data loss/security/exposure) | S2 (feature broken) | S3 (hindrance) | S4 (cosmetic)
Scenario: QA-XX step N
Viewport / device / browser:
Role: OWNER | ADMIN | MEMBER | HELPER
Expected:
Actual:
Evidence: screenshot / console / correlation id (from the error page)
Requirements affected:
Task to raise:
```
