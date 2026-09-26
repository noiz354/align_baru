# Authorization Matrix

> Normative table of **who may do what**. Every operation in API.md must appear here; every row must have a negative test (T-SEC-003).
> Roles: **OWNER** (exactly one, can do everything, cannot be removed) · **ADMIN** (household administration) · **MEMBER** (full day-to-day use) · **HELPER** (temporary, narrow: read + assigned work + issue reporting).
> "Read" always means *within the member's own household*. Isolation failures return `NOT_FOUND` — never `FORBIDDEN` — so existence is never confirmed (SECURITY.md §3).

## Legend

`✔` allowed · `✖` denied (`FORBIDDEN` or `ROLE_NOT_PERMITTED`) · `△` allowed with a documented condition · `—` not applicable / no such surface.

## 1. Household & membership

| Operation | OWNER | ADMIN | MEMBER | HELPER | Condition / notes |
| --- | --- | --- | --- | --- | --- |
| View household settings | ✔ | ✔ | ✔ | ✔ | Everyone must see timezone, quiet hours, member list |
| Edit household name / timezone | ✔ | ✔ | ✖ | ✖ | Timezone change affects future dates only (I-HH-002) |
| Edit quiet hours & alert policy | ✔ | ✔ | ✖ | ✖ | Members keep personal overrides in their own preferences |
| Edit resource threshold defaults | ✔ | ✔ | ✖ | ✖ | Per-resource overrides are T-RES-015, same rule |
| Invite a member | ✔ | ✔ | ✖ | ✖ | Rate limited 20/day |
| Cancel a pending invitation | ✔ | ✔ | ✖ | ✖ | |
| Change a member's role | ✔ | △ | ✖ | ✖ | ADMIN cannot promote to OWNER or demote an OWNER; cannot change their own role |
| Remove a member | ✔ | △ | ✖ | ✖ | ADMIN cannot remove OWNER/ADMIN; last owner blocked (I-XA-003) |
| Transfer ownership | ✔ | ✖ | ✖ | ✖ | Atomic demote+promote; audited |
| Leave household | ✔△ | ✔ | ✔ | ✔ | OWNER blocked with `LAST_OWNER_CANNOT_LEAVE` until transfer |
| Revoke a member's sessions | ✔ | ✔ | ✖ | ✖ | Also used for lost devices (RUNBOOK §6) |
| Export household data | ✔ | ✖ | ✖ | ✖ | 2/day; audited; contains no other member's private fields beyond what they already see |
| Delete household | ✔ | ✖ | ✖ | ✖ | Operator-verified procedure (RUNBOOK §10); product surface only *requests* it |
| View audit log entries about you | ✔ | ✔ | ✔ | ✔ | Members see role/permission events affecting them; full log is operator-only |

## 2. Auth & account

| Operation | OWNER | ADMIN | MEMBER | HELPER | Notes |
| --- | --- | --- | --- | --- | --- |
| Sign in / sign out | ✔ | ✔ | ✔ | ✔ | self only |
| Reset own password | ✔ | ✔ | ✔ | ✔ | Emailed token or operator-issued link |
| Edit own display name / avatar initials | ✔ | ✔ | ✔ | ✔ | self only |
| Edit own notification preferences | ✔ | ✔ | ✔ | ✔ | self only; caps and quiet hours *defaults* are household-level |
| Manage own push subscriptions | ✔ | ✔ | ✔ | ✔ | self only, per device |
| Delete own account | ✔△ | ✔ | ✔ | ✔ | Owner must transfer first (`OWNER_TRANSFER_REQUIRED`) |
| View another member's preferences/sessions | ✖ | ✖ | ✖ | ✖ | Never — no such read exists in the API |

## 3. Rooms

| Operation | OWNER | ADMIN | MEMBER | HELPER | Notes |
| --- | --- | --- | --- | --- | --- |
| View rooms & status | ✔ | ✔ | ✔ | ✔ | Read model includes reasons, not scores |
| Create room | ✔ | ✔ | ✔ | ✖ | HELPER joins an established household; keeps the app calm |
| Edit room (name, group, order, not-in-use) | ✔ | ✔ | ✔ | ✖ | |
| Archive room | ✔ | ✔ | ✖ | ✖ | Requires handling of open occurrences (I-ROOM-004) |
| Set / clear status override | ✔ | ✔ | ✔ | ✖ | Any working member may correct reality |
| View override attribution | ✔ | ✔ | ✔ | ✔ | Transparency is deliberate; no anonymous overrides |

## 4. Chores

| Operation | OWNER | ADMIN | MEMBER | HELPER | Notes |
| --- | --- | --- | --- | --- | --- |
| View chores & history | ✔ | ✔ | ✔ | ✔ | |
| Create chore definition (recurring) | ✔ | ✔ | ✔ | ✖ | |
| Create one-off task / ad-hoc occurrence | ✔ | ✔ | ✔ | ✔ | HELPER can pick up work |
| Edit definition | ✔ | ✔ | △ | ✖ | △ creator or current assignee may edit; others need ADMIN |
| Pause / resume definition | ✔ | ✔ | △ | ✖ | △ assignee may pause their own chore |
| Archive definition | ✔ | ✔ | ✖ | ✖ | History retained |
| Complete occurrence | ✔ | ✔ | ✔ | ✔ | Assigned work is work |
| Skip occurrence (reason required) | ✔ | ✔ | ✔ | △ | HELPER may skip only occurrences assigned to them |
| Snooze occurrence (bounded) | ✔ | ✔ | ✔ | ✖ | HELPER asks a member instead |
| Reassign / claim occurrence | ✔ | ✔ | ✔ | ✖ | Claim is self-assignment; HELPER cannot claim (they are already narrow) |
| Reopen a completion | ✔ | ✔ | △ | ✖ | △ the completer, within 24 h; OWNER/ADMIN any time with reason |

## 5. Trash

| Operation | OWNER | ADMIN | MEMBER | HELPER | Notes |
| --- | --- | --- | --- | --- | --- |
| View containers & history | ✔ | ✔ | ✔ | ✔ | |
| Create / edit container | ✔ | ✔ | ✔ | ✖ | |
| Archive container | ✔ | ✔ | ✖ | ✖ | |
| Mark almost full / full | ✔ | ✔ | ✔ | ✔ | Helps; no privilege needed to tell the truth |
| Reset state with reason | ✔ | ✔ | ✔ | ✖ | Resetting hides information, so it stays with members |
| Assign / claim collection | ✔ | ✔ | ✔ | △ | △ HELPER may claim but not assign to others |
| Complete collection | ✔ | ✔ | ✔ | ✔ | |

## 6. Resources & shopping

| Operation | OWNER | ADMIN | MEMBER | HELPER | Notes |
| --- | --- | --- | --- | --- | --- |
| View resources | ✔ | ✔ | ✔ | ✔ | |
| Create / edit resource | ✔ | ✔ | ✔ | ✖ | |
| Update level (used one, level chips) | ✔ | ✔ | ✔ | ✔ | The highest-frequency action; nobody should be blocked |
| Restock | ✔ | ✔ | ✔ | ✔ | |
| Change quantity mode | ✔ | ✔ | ✖ | ✖ | Resets the level (destructive-ish) |
| Archive resource | ✔ | ✔ | ✖ | ✖ | |
| Adjust thresholds (per resource) | ✔ | ✔ | ✖ | ✖ | |
| Shopping list: view | ✔ | ✔ | ✔ | ✔ | |
| Shopping list: add / remove manual items | ✔ | ✔ | ✔ | ✔ | |
| Shopping list: mark bought | ✔ | ✔ | ✔ | ✔ | May restock a linked resource |

## 7. Maintenance

| Operation | OWNER | ADMIN | MEMBER | HELPER | Notes |
| --- | --- | --- | --- | --- | --- |
| View assets, plans, records | ✔ | ✔ | ✔ | ✔ | |
| Create / edit asset | ✔ | ✔ | ✔ | ✖ | |
| Create / edit plan | ✔ | ✔ | ✔ | ✖ | |
| Pause / resume plan | ✔ | ✔ | ✔ | ✖ | |
| Record service (+ vendor/cost note) | ✔ | ✔ | ✔ | ✖ | HELPER may report a problem but not claim service was done |
| Archive asset | ✔ | ✔ | ✖ | ✖ | |
| Link issue ↔ plan/record | ✔ | ✔ | ✔ | ✖ | |

## 8. Issues

| Operation | OWNER | ADMIN | MEMBER | HELPER | Notes |
| --- | --- | --- | --- | --- | --- |
| View issues | ✔ | ✔ | ✔ | ✔ | HELPER sees all issues — they may be the person who fixes it |
| Report issue (+ optional photo) | ✔ | ✔ | ✔ | ✔ | Core HELPER capability |
| Edit own issue (title/description before acknowledgement) | ✔ | ✔ | ✔ | △ | △ own reports only, while OPEN |
| Add comment | ✔ | ✔ | ✔ | ✔ | Closed issues reject comments for everyone |
| Add / remove own photo | ✔ | ✔ | ✔ | △ | △ own reports only |
| Acknowledge | ✔ | ✔ | ✔ | ✖ | Acknowledgement means "I'm taking responsibility" |
| Set IN_PROGRESS / RESOLVED | ✔ | ✔ | ✔ | △ | △ HELPER may mark their own work resolved; closing is separate |
| Close | ✔ | ✔ | △ | ✖ | △ reporter may close their own issue |
| Mark WONT_FIX (reason required) | ✔ | ✔ | ✖ | ✖ | |
| Assign / unassign | ✔ | ✔ | ✔ | ✖ | |
| Change severity | ✔ | ✔ | ✔ | ✖ | Severity drives alert urgency |
| Delete issue | ✖ | ✖ | ✖ | ✖ | Deleted issues would rewrite history; use WONT_FIX or archive (T-ISSUE-010) |

## 9. Alerts

| Operation | OWNER | ADMIN | MEMBER | HELPER | Notes |
| --- | --- | --- | --- | --- | --- |
| View alerts | ✔ | ✔ | ✔ | ✔ | Household-visible; this is not private messaging |
| Acknowledge | ✔ | ✔ | ✔ | △ | △ intended recipient or anyone when unassigned; a HELPER cannot acknowledge work they were not given |
| Snooze | ✔ | ✔ | ✔ | ✖ | Snooze changes when everyone sees it matter |
| Resolve manually (reason required) | ✔ | ✔ | ✔ | ✖ | |
| Reassign recipient | ✔ | ✔ | ✔ | ✖ | Must be an active member of this household |
| Cancel / dismiss | ✔ | ✔ | ✖ | ✖ | Dismissal is different from resolution; recorded (INFO alerts only) |
| Edit alert policy (escalation, caps, expiry) | ✔ | ✔ | ✖ | ✖ | |
| View why-this-alert surface | ✔ | ✔ | ✔ | ✔ | Transparency reduces disputes |

## 10. Activity, exports, settings

| Operation | OWNER | ADMIN | MEMBER | HELPER | Notes |
| --- | --- | --- | --- | --- | --- |
| View activity history | ✔ | ✔ | ✔ | ✔ | Same view for everyone — no privileged feed (PRIVACY.md PP-9) |
| Filter activity | ✔ | ✔ | ✔ | ✔ | Filters are not recorded |
| Export data | ✔ | ✖ | ✖ | ✖ | Household-level export; rate limited; audited |
| Request household deletion | ✔ | ✖ | ✖ | ✖ | Operator-executed (RUNBOOK §10) |
| View own sessions/devices | ✔ | ✔ | ✔ | ✔ | self only |
| Configure PWA install / push | ✔ | ✔ | ✔ | ✔ | self only |

## 11. System surfaces

| Surface | Authentication | Authorization | Notes |
| --- | --- | --- | --- |
| `GET /api/health` | none | none | Never returns household data or counts |
| `GET /api/health?deep=1` | none | none | Returns statuses and stale-job flags only; no member/row identifiers beyond coarse counts |
| `POST /api/cron/[job]` | `x-cron-secret` (constant-time compare) | job allow-list | Rate limited 30/min; jobs construct per-household contexts internally |
| `POST /api/push/subscribe` | session | self only | Endpoint stored hashed; member id from session, never from body |
| `DELETE /api/push/subscribe` | session | self only | Device sign-out path |
| `GET /api/attachments/[id]` | session | household-scoped, `NOT_FOUND` otherwise | Content-Disposition + nosniff; no public URLs |

## 12. Standard denials (must be tested)

| Attempt | Expected |
| --- | --- |
| Any operation with another household's entity id | `NOT_FOUND` |
| Any admin operation by MEMBER or HELPER | `FORBIDDEN` / `ROLE_NOT_PERMITTED` |
| Admin removing the owner, or the owner removing themselves | `LAST_OWNER_CANNOT_LEAVE` / `ROLE_NOT_PERMITTED` |
| HELPER creating a recurring chore, snoozing, or closing an issue | Denied |
| Anyone reading another member's preferences, devices, or activity counts | No such endpoint exists (test asserts the route is absent) |
| Anonymous cron trigger | 401, no job executed |
| Attachment fetch after member removal | `NOT_FOUND` (sessions already deleted) |
