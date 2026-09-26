# PRD — HomeOps

> Product Requirements Document · Version 1.0 (architecture phase) · 2026-09-26
> Status: **APPROVED FOR SKELETON PHASE** — no requirement in this document has been implemented. See ARCHITECTURE.md and ROADMAP.md for build sequencing.
> Requirement IDs are permanent. Every requirement maps to at least one task in TASKS.md and one row in docs/TRACEABILITY.md.

## 1. Product statement

HomeOps is a private web application (installable PWA) that helps the members of **one household** keep their home clean, organized, supplied, safe, maintainable and easy to operate — without turning household work into project management.

It answers four questions every day:

1. **What needs attention right now?**
2. **What is due today?**
3. **What is running out or overdue?**
4. **Who is doing what, and what has already been done?**

It is explicitly **not**: a family social network, a surveillance tool, an enterprise CMMS, a finance tracker, or a project-management suite.

## 2. Target user & context

| Aspect | Description |
| --- | --- |
| Primary user | Adults sharing a home (couple, family, shared flat). 2–10 members. |
| Devices | Personal phone first (used while standing in front of the actual problem), laptop occasionally. |
| Literacy with software | Mixed. One member may be the "household admin"; others should never need configuration. |
| Usage pattern | Short, frequent, interrupt-driven sessions (5–60 seconds), often one-handed. |
| Environment | Kitchen, laundry, bathroom, trash area — bright light or darkness, wet hands, one hand holding a bag. |
| Timezone | A single household timezone (default from household creation, e.g. `Asia/Jakarta`), with a member override only for display. |
| Language | v1 ships copy in English; all user-visible strings live in one module so a second locale (e.g. Bahasa Indonesia) is a translation task, not a refactor. |

## 3. Problem statement

Household work fails in predictable ways:

- **Invisible work**: nobody notices until it is a crisis ("we have no clean towels").
- **Unclear accountability**: chores are "everyone's", so nobody's.
- **Supply surprises**: resources run out silently (toilet paper, cooking oil, detergent).
- **Maintenance is forgotten** until an appliance breaks: water filter, AC service, water tank cleaning.
- **Reported problems evaporate**: a leaking tap is mentioned once, then forgotten.
- **Attention is scarce**: existing apps (shared to-do lists, notes apps, spreadsheets) produce either noise or nothing at all.

HomeOps' core bet: **a small number of high-signal, actionable items beats a complete record of everything.** Everything in the design (DESIGN.md, ALERTS.md) serves that bet.

## 4. Goals & non-goals

### 4.1 Goals

| ID | Goal |
| --- | --- |
| G-1 | A member can open HomeOps and know what to do next within 5 seconds. |
| G-2 | Marking a chore done takes one tap from the dashboard, with no form. |
| G-3 | Household supplies stop running out silently. |
| G-4 | Recurring maintenance happens on a schedule, not after a failure. |
| G-5 | Reported issues have a visible owner and a visible state until closed. |
| G-6 | Only the right person is notified, at the right time, with a maximum of one alert per real-world problem. |
| G-7 | All household data stays inside the household's own deployment; nothing is shared or sold. |
| G-8 | One developer can operate the whole thing: one database, one process, one pipeline. |

### 4.2 Non-goals (v1)

| ID | Non-goal | Rationale |
| --- | --- | --- |
| NG-1 | Multi-household organizations, teams, or workspaces per user | A user belongs to one household; tenancy exists only to enforce isolation (ADR-005). |
| NG-2 | Financial budgeting, bill splitting, expense tracking | Different product; high privacy surface. |
| NG-3 | Chore gamification, points, streaks, leaderboards | Creates surveillance pressure between people who live together; no requirement supports it. |
| NG-4 | Real-time chat or social feed | Alerts + activity history + issue comments cover coordination. |
| NG-5 | Vendor marketplace, booking, payments | Out of scope; vendors are stored as free-text contact info only. |
| NG-6 | Asset lifecycle costing / depreciation reports | Enterprise CMMS territory; see ADR-012. |
| NG-7 | Location tracking of members (presence, geofencing) | PRIVACY.md forbids it outright. |
| NG-8 | Native iOS/Android apps | PWA covers install + push. |
| NG-9 | Offline-first full data sync | v1 offline behaviour is a read-only shell + friendly error. See ADR-014. |
| NG-10 | Public API for third parties | No consumers exist. |

## 5. Personas

| Persona | Description | Primary needs |
| --- | --- | --- |
| **Ayu — household admin** | Runs the home's logistics. Sets up rooms, chores, maintenance plans, resources. | Fast setup, low babysitting, confidence that nothing is silently overdue. |
| **Budi — participant** | Does chores when told/reminded. Rarely opens the app proactively. | One-tap completion, single clear alert, no configuration. |
| **Citra — occasional helper** | Domestic helper or extended family, present 2×/week. | Sees today's list, can mark done, can report an issue; cannot administer the household. |
| **Dedi — the fixer** | Handles repairs and outside coordination. | Issue queue with photos, maintenance due list, vendor notes. |

## 6. Scope by capability

Each capability below has numbered functional requirements. `P0` = required for the product to be worth using; `P1` = required for v1 release; `P2` = valuable, not blocking.

### 6.1 Household & tenancy (FR-HH)

| ID | P | Requirement |
| --- | --- | --- |
| FR-HH-001 | P0 | A signed-in user can create a household by giving it a name and a timezone. |
| FR-HH-002 | P0 | Creating a household makes the creator its `OWNER` member. |
| FR-HH-003 | P0 | Every household-scoped record carries a `householdId`; no read or write may cross households. |
| FR-HH-004 | P0 | The active household is derived from the session, never from client-supplied input. |
| FR-HH-005 | P0 | A user may belong to at most one household (v1). |
| FR-HH-006 | P1 | The household stores a default timezone used for all scheduling and "today" calculations. |
| FR-HH-007 | P1 | An owner can rename the household and change its timezone. |
| FR-HH-008 | P1 | Timezone changes never rewrite already-materialised due dates; only future occurrences are affected. |
| FR-HH-009 | P2 | Households can define their week start (Monday default) for weekly views. |
| FR-HH-010 | P2 | A household can be archived (read-only) but not hard-deleted by a member. |
| FR-HH-011 | P1 | Every household-scoped mutation records who performed it and when. |
| FR-HH-012 | P1 | A household has a stable human-readable slug/name plus an opaque id; ids are never sequential integers. |

### 6.2 Members & invitations (FR-MEM)

| ID | P | Requirement |
| --- | --- | --- |
| FR-MEM-001 | P0 | A household has members with roles: `OWNER`, `ADMIN`, `MEMBER`, `HELPER`. |
| FR-MEM-002 | P0 | Only `OWNER`/`ADMIN` may invite, change roles, or remove members. |
| FR-MEM-003 | P0 | Invitations are single-use, expiring, revocable tokens bound to an email address or shareable link. |
| FR-MEM-004 | P0 | Accepting an invitation creates a membership in the inviting household only. |
| FR-MEM-005 | P1 | Members can set a display name and optional avatar colour; email is not shown to other members by default. |
| FR-MEM-006 | P1 | Removing a member immediately invalidates their sessions and their channel subscriptions. |
| FR-MEM-007 | P1 | A member can leave a household voluntarily, unless they are the last `OWNER`. |
| FR-MEM-008 | P2 | The last owner can transfer ownership to another member. |
| FR-MEM-009 | P1 | A member can be marked "away" for a date range; while away they are not selected as alert recipients. |
| FR-MEM-010 | P2 | Roles are enforced server-side; UI hiding is never the control (see SECURITY.md). |

### 6.3 Authentication & session (FR-AUTH)

| ID | P | Requirement |
| --- | --- | --- |
| FR-AUTH-001 | P0 | A user can sign up and sign in without a third-party identity provider. |
| FR-AUTH-002 | P0 | Sessions are server-side records; deleting a session row logs the user out everywhere immediately. |
| FR-AUTH-003 | P0 | Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, with a rotating token. |
| FR-AUTH-004 | P0 | All state-changing requests are protected against CSRF. |
| FR-AUTH-005 | P1 | Authentication attempts are rate limited per identifier and per IP. |
| FR-AUTH-006 | P1 | A user can sign out of one device or all devices. |
| FR-AUTH-007 | P1 | Password recovery is available and its tokens are single-use and short-lived. |
| FR-AUTH-008 | P2 | Optional second factor (TOTP) can be enabled per user. |

### 6.4 Rooms (FR-ROOM)

| ID | P | Requirement |
| --- | --- | --- |
| FR-ROOM-001 | P0 | A household can define rooms with a name; rooms are first-class, not labels. |
| FR-ROOM-002 | P0 | A room exposes exactly one state: `CLEAN`, `NEEDS_ATTENTION`, `DIRTY`, `CLEANING`, `UNKNOWN`. |
| FR-ROOM-003 | P0 | Room state is derived by a documented rule set (ADR-010), never by a numeric cleanliness score. |
| FR-ROOM-004 | P0 | A member can set a room's state manually; the manual override is visible and has an expiry. |
| FR-ROOM-005 | P1 | A room can be archived without deleting its history. |
| FR-ROOM-006 | P1 | A room shows which chores reference it and which are overdue. |
| FR-ROOM-007 | P1 | Rooms can be ordered/grouped (e.g. by floor) for scanning. |
| FR-ROOM-008 | P2 | A room can be marked "not in use", removing it from dashboards and alert evaluation. |

### 6.5 Chores (FR-CHORE)

| ID | P | Requirement |
| --- | --- | --- |
| FR-CHORE-001 | P0 | A chore definition is reusable: title, optional description, optional room, priority, optional assignee, optional recurrence. |
| FR-CHORE-002 | P0 | Chore definitions are separated from chore occurrences (a scheduled instance) and completions (a recorded event). |
| FR-CHORE-003 | P0 | A chore can be one-off or recurring. |
| FR-CHORE-004 | P0 | A member can complete an occurrence with one action; completion records actor and timestamp. |
| FR-CHORE-005 | P0 | Completing a chore is idempotent: repeating the same completion target does not create duplicates. |
| FR-CHORE-006 | P0 | Completing an occurrence optionally supports a short note and a photo. |
| FR-CHORE-007 | P0 | A member can skip an occurrence with a reason; skipping is part of the record, not a deletion. |
| FR-CHORE-008 | P0 | A member can reassign an occurrence to another member. |
| FR-CHORE-009 | P0 | A member can snooze an occurrence to a later date, recording who snoozed it and for how long. |
| FR-CHORE-010 | P1 | A member can add an ad-hoc (unplanned) chore that behaves like a one-off definition. |
| FR-CHORE-011 | P0 | Chore occurrences expose `dueAt` in the household timezone. |
| FR-CHORE-012 | P1 | Chores carry an optional estimated duration used for "is this quick?" hints only — never for scoring people. |
| FR-CHORE-013 | P1 | Chores have a priority: `LOW`, `NORMAL`, `HIGH`. |
| FR-CHORE-014 | P0 | Supported recurrences: one-time, daily, specific weekdays, weekly (N weeks), monthly (N months), every N days, and **after previous completion**. |
| FR-CHORE-015 | P0 | Calendar-based recurrence computes from the schedule; completion-based recurrence computes from `lastCompletedAt`. |
| FR-CHORE-016 | P0 | Recurrence evaluation is timezone-aware and DST-safe; "today" is evaluated in household time. |
| FR-CHORE-017 | P1 | A recurring chore does not stack: at most one open occurrence per chore definition at a time. |
| FR-CHORE-018 | P1 | A household can pause a recurring chore without losing its definition. |
| FR-CHORE-019 | P2 | A chore can be archived; archiving keeps history and stops future materialisation. |
| FR-CHORE-020 | P1 | Chore history (who completed what, when) is visible on the chore detail page. |

### 6.6 Trash (FR-TRASH)

| ID | P | Requirement |
| --- | --- | --- |
| FR-TRASH-001 | P0 | A household can define one or more trash containers (e.g. kitchen, recycling, garden). |
| FR-TRASH-002 | P0 | A container has exactly one state: `EMPTY`, `AVAILABLE`, `ALMOST_FULL`, `FULL`, `COLLECTION_REQUIRED`. |
| FR-TRASH-003 | P0 | A member can mark a container almost full, full, or reset it. |
| FR-TRASH-004 | P0 | A member can assign a collection to a member (a who/when commitment), distinct from doing it. |
| FR-TRASH-005 | P0 | A member can record "collected", which resets the container state and closes related alerts. |
| FR-TRASH-006 | P0 | Container state changes are recorded as events, not overwritten values only. |
| FR-TRASH-007 | P1 | A household can define a collection schedule (e.g. Tue/Fri mornings) used to raise collection reminders. |
| FR-TRASH-008 | P1 | Trash thresholds have hysteresis: `FULL` does not flap between states on small changes. |
| FR-TRASH-009 | P1 | Trash state history is visible for at least the last 30 days. |
| FR-TRASH-010 | P2 | Container capacity is descriptive text only; no numeric filling model is invented. |

### 6.7 Resources & restock (FR-RES)

| ID | P | Requirement |
| --- | --- | --- |
| FR-RES-001 | P0 | A household can track consumables (e.g. toilet paper, soap, detergent, garbage bags, drinking water, cleaning liquid, rice, cooking oil, tissue, batteries, pet food). |
| FR-RES-002 | P0 | A resource has exactly one quantity mode: `EXACT`, `APPROXIMATE`, or `AVAILABLE_UNAVAILABLE`. |
| FR-RES-003 | P0 | `APPROXIMATE` uses exactly one of `FULL`, `ENOUGH`, `LOW`, `CRITICAL`, `EMPTY`. |
| FR-RES-004 | P0 | A member can adjust the level in one or two taps (including a "used one" quick action). |
| FR-RES-005 | P0 | A resource has a configurable low threshold and critical threshold per mode. |
| FR-RES-006 | P0 | A resource can have a target/par level and a restock lead time. |
| FR-RES-007 | P0 | Marking a resource low or critical creates a restock need visible on shopping surfaces. |
| FR-RES-008 | P0 | A member can mark a resource restocked, which sets the level and closes related alerts. |
| FR-RES-009 | P1 | Multiple low resources are grouped into **one** shopping alert rather than one alert per item. |
| FR-RES-010 | P1 | Resources can be linked to a room/location for finding and storing them. |
| FR-RES-011 | P2 | A resource can record a preferred brand/notes and a typical purchase size. |
| FR-RES-012 | P1 | Resource level changes are recorded with actor and timestamp. |

### 6.8 Shopping / restock list (FR-SHOP)

| ID | P | Requirement |
| --- | --- | --- |
| FR-SHOP-001 | P1 | A single list shows everything that needs buying, with quantity hints where known. |
| FR-SHOP-002 | P1 | Items can be added manually and removed by marking them bought. |
| FR-SHOP-003 | P1 | Marking an item bought updates the linked resource level when the link exists. |
| FR-SHOP-004 | P2 | The list can be copied as plain text for use in any chat app. |

### 6.9 Maintenance & assets (FR-MNT)

| ID | P | Requirement |
| --- | --- | --- |
| FR-MNT-001 | P0 | A household can register assets (e.g. AC unit, water filter, refrigerator, washing machine, water tank). |
| FR-MNT-002 | P0 | A maintenance plan belongs to an asset (or the household) and repeats on a frequency. |
| FR-MNT-003 | P0 | Frequencies supported: every N days, every N weeks, every N months, every N years, or fixed calendar months. |
| FR-MNT-004 | P0 | A plan exposes `lastServiceAt` and `nextServiceAt`. |
| FR-MNT-005 | P0 | Completing a maintenance service records actor, date, optional vendor, optional cost, and notes. |
| FR-MNT-006 | P0 | A plan can be assigned to a member and optionally a vendor. |
| FR-MNT-007 | P0 | Maintenance raises an alert before it is due (lead time) and again when overdue. |
| FR-MNT-008 | P1 | Maintenance records are kept as an append-only service history per asset. |
| FR-MNT-009 | P1 | A plan can be paused (e.g. seasonally) without losing history. |
| FR-MNT-010 | P1 | Estimated cost is informational; there is no budgeting, invoicing, or accounting. |
| FR-MNT-011 | P2 | A plan can link to an open issue that triggered it. |
| FR-MNT-012 | P1 | Maintenance is deliberately thinner than a CMMS: no work orders, no approvals, no multi-level scheduling. |

### 6.10 Issues & repairs (FR-ISSUE)

| ID | P | Requirement |
| --- | --- | --- |
| FR-ISSUE-001 | P0 | Any member can report an issue with a title, optional room/asset, optional photo, and severity. |
| FR-ISSUE-002 | P0 | Reportable in under 20 seconds from the dashboard (photo optional, never required). |
| FR-ISSUE-003 | P0 | An issue lifecycle exists: `OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED`, plus `WONT_FIX`. |
| FR-ISSUE-004 | P0 | Transitions are recorded with actor and timestamp; invalid transitions are rejected server-side. |
| FR-ISSUE-005 | P1 | An issue can be assigned to a member and/or a vendor. |
| FR-ISSUE-006 | P1 | An issue has severity: `LOW`, `NORMAL`, `HIGH`, `SAFETY`. |
| FR-ISSUE-007 | P0 | Unacknowledged issues raise an alert after a household-defined delay. |
| FR-ISSUE-008 | P1 | Members can add short comments/updates and photos to an issue. |
| FR-ISSUE-009 | P1 | Resolving an issue optionally creates a follow-up chore or maintenance record. |
| FR-ISSUE-010 | P2 | Issues can be linked to the asset they concern, feeding that asset's history. |

### 6.11 Alerts (FR-ALERT)

| ID | P | Requirement |
| --- | --- | --- |
| FR-ALERT-001 | P0 | An alert is a durable, first-class record with state: `OPEN`, `ACKNOWLEDGED`, `SNOOZED`, `RESOLVED`, `EXPIRED`. |
| FR-ALERT-002 | P0 | Alert types include: `CHORE_DUE`, `CHORE_OVERDUE`, `TRASH_FULL`, `TRASH_COLLECTION_DUE`, `RESOURCE_LOW`, `RESOURCE_CRITICAL`, `MAINTENANCE_DUE`, `MAINTENANCE_OVERDUE`, `ISSUE_REQUIRES_ATTENTION`, `HOUSEHOLD_REMINDER`. |
| FR-ALERT-003 | P0 | Priority: `INFO`, `ATTENTION`, `IMPORTANT`, `URGENT`. |
| FR-ALERT-004 | P0 | Every alert answers: what happened, why it matters, who should act, what action is available, when action is expected. |
| FR-ALERT-005 | P0 | Alerts are deduplicated by a stable dedupe key so the same real-world condition cannot produce two open alerts. |
| FR-ALERT-006 | P0 | Related low-priority alerts are grouped into one item (e.g. one shopping alert for many resources). |
| FR-ALERT-007 | P0 | An alert can be acknowledged (seen/owned) without being resolved. |
| FR-ALERT-008 | P0 | An alert can be snoozed for a bounded duration with a recorded actor. |
| FR-ALERT-009 | P0 | An alert resolves automatically when its underlying condition clears. |
| FR-ALERT-010 | P0 | Each alert has an intended recipient (member or role), not "everyone". |
| FR-ALERT-011 | P1 | Unacknowledged `IMPORTANT`/`URGENT` alerts escalate after a household-configured delay. |
| FR-ALERT-012 | P1 | Quiet hours suppress non-`URGENT` delivery; alerts still appear in-app. |
| FR-ALERT-013 | P1 | Deliberate caps exist: a maximum number of delivered notifications per member per day, with overflow summarised. |
| FR-ALERT-014 | P2 | Members can see a short "why did I get this?" explanation for each alert. |

### 6.12 Notifications (FR-NOTIF)

| ID | P | Requirement |
| --- | --- | --- |
| FR-NOTIF-001 | P0 | Alert (domain) and notification (delivery) are separate concepts. |
| FR-NOTIF-002 | P0 | Flow is: domain event → alert → notification policy → delivery. |
| FR-NOTIF-003 | P1 | Channels: in-app (always), PWA push, email. |
| FR-NOTIF-004 | P0 | Per-member channel preferences: type × channel matrix, with a sane default. |
| FR-NOTIF-005 | P1 | Per-member quiet hours are respected for non-urgent alerts. |
| FR-NOTIF-006 | P0 | Delivery attempts and outcomes are recorded for diagnostics. |
| FR-NOTIF-007 | P1 | Push subscriptions are registered per device and removed on failure (`410/404`). |
| FR-NOTIF-008 | P1 | Notification failures never roll back the domain change that generated them. |
| FR-NOTIF-009 | P2 | Future channels (WhatsApp, Telegram, SMS, smart home) are documented but unimplemented. |
| FR-NOTIF-010 | P1 | Recipient selection is explicit: assigned member → role → all admins; never broadcast by default. |

### 6.13 Dashboard & today (FR-DASH)

| ID | P | Requirement |
| --- | --- | --- |
| FR-DASH-001 | P0 | `/today` presents, in order: immediate attention, due today, overdue, quick actions, room status, low resources, maintenance, upcoming work, recent activity. |
| FR-DASH-002 | P0 | Every dashboard card is actionable or explicitly informational; no dead cards. |
| FR-DASH-003 | P0 | Quick actions complete a core task in one tap: complete chore, mark trash full, restock, report issue. |
| FR-DASH-004 | P1 | The dashboard shows a clear empty state when nothing needs attention ("All clear"). |
| FR-DASH-005 | P1 | Cards may be collapsed/expanded; ordering is stable and documented, not user-randomised. |
| FR-DASH-006 | P1 | Dashboard data is scoped to the active household and the household timezone. |
| FR-DASH-007 | P1 | Dashboard renders a useful first paint in ≤ 2 s on a mid-range phone on 4G (PERFORMANCE.md). |
| FR-DASH-008 | P2 | Members can hide cards they do not use; the default set is never empty. |

### 6.14 Activity history (FR-ACT)

| ID | P | Requirement |
| --- | --- | --- |
| FR-ACT-001 | P0 | Significant domain changes append an activity record: what, who, when, in which household, about which entity. |
| FR-ACT-002 | P0 | Activity records are append-only and never edited. |
| FR-ACT-003 | P1 | `/activity` shows a reverse-chronological, filterable list (by type, member, room, date). |
| FR-ACT-004 | P1 | Entity detail pages show their own recent history. |
| FR-ACT-005 | P1 | Activity records older than the retention window are pruned (PRIVACY.md). |
| FR-ACT-006 | P2 | Activity is not a surveillance feed: no read receipts, no location, no "who opened the app". |

### 6.15 Settings (FR-SET)

| ID | P | Requirement |
| --- | --- | --- |
| FR-SET-001 | P1 | `/settings/household` — name, timezone, week start, lead times. |
| FR-SET-002 | P1 | `/settings/members` — invite, roles, remove, ownership transfer. |
| FR-SET-003 | P1 | `/settings/notifications` — channel matrix, quiet hours, escalation delay, daily cap. |
| FR-SET-004 | P1 | `/settings/preferences` — display name, theme, reduced motion, week start override. |
| FR-SET-005 | P2 | `/settings/data` — export household data, request deletion. |
| FR-SET-006 | P1 | Household-level thresholds (resource low/critical, alert lead times) are configurable, with documented defaults. |

### 6.16 PWA & offline (FR-PWA)

| ID | P | Requirement |
| --- | --- | --- |
| FR-PWA-001 | P1 | The app is installable (manifest, icons, standalone display) on Android, iOS and desktop. |
| FR-PWA-002 | P1 | A service worker provides an offline shell and a cached last-known `/today` is **not** trusted as current — the UI must show staleness. |
| FR-PWA-003 | P1 | Push notifications work on installed PWAs, including iOS 16.4+. |
| FR-PWA-004 | P2 | Actions taken while offline are surfaced as failed with a retry affordance; no silent queueing in v1. |

### 6.17 Non-functional (NFR)

| ID | P | Requirement |
| --- | --- | --- |
| NFR-PERF-001 | P0 | Dashboard p75 server response ≤ 400 ms; p95 ≤ 1200 ms (PERFORMANCE.md). |
| NFR-PERF-002 | P1 | Client JS for first load of `/today` ≤ 180 kB gzip. |
| NFR-PERF-003 | P1 | Any tap receives visible feedback within 100 ms. |
| NFR-PERF-004 | P2 | Scheduler tick completes within 10 s for a household-scale dataset. |
| NFR-PERF-005 | P1 | DB queries on hot paths are indexed and bounded; no unbounded scans (DATA_MODEL.md). |
| NFR-PERF-006 | P2 | The app degrades gracefully on 3G/slow CPU rather than becoming unusable. |
| NFR-SEC-001 | P0 | Every household-scoped access is authorised server-side against the caller's membership. |
| NFR-SEC-002 | P0 | Cross-household access is impossible by construction (scoped repository ports + tests). |
| NFR-SEC-003 | P0 | Input is validated at boundaries; output is encoded; SQL is parameterised. |
| NFR-SEC-004 | P0 | Sessions are secure, revocable, and CSRF-protected. |
| NFR-SEC-005 | P0 | Rate limiting on auth, invitation acceptance, and mutation endpoints. |
| NFR-SEC-006 | P1 | Secure headers (CSP, HSTS, frame-ancestors, referrer policy) are set globally. |
| NFR-SEC-007 | P1 | Secrets come from environment/secret store; none are committed; none are logged. |
| NFR-SEC-008 | P1 | Uploads are validated by type/size, stored outside the web root, and served with safe content types. |
| NFR-SEC-009 | P1 | Security-relevant events (login, invite, role change, removal) are audit logged. |
| NFR-SEC-010 | P1 | Dependency vulnerabilities are tracked; patch cadence documented in OPERATIONS.md. |
| NFR-PRIV-001 | P0 | Data minimisation: collect only what a feature needs. |
| NFR-PRIV-002 | P0 | No third-party analytics, ad SDKs, or tracking pixels. |
| NFR-PRIV-003 | P0 | Logs never contain member PII, photos, or free-text issue descriptions. |
| NFR-PRIV-004 | P1 | Retention windows are defined and enforced by the retention job. |
| NFR-PRIV-005 | P1 | A household can export its data and request deletion. |
| NFR-PRIV-006 | P1 | Photos are household-scoped, access-controlled, and deletable. |
| NFR-PRIV-007 | P1 | No presence/location/behaviour inference features. |
| NFR-PRIV-008 | P2 | Notification payloads avoid sensitive detail on lock screens (configurable). |
| NFR-A11Y-001 | P0 | WCAG 2.2 AA for core journeys. |
| NFR-A11Y-002 | P0 | Full keyboard operability with visible focus. |
| NFR-A11Y-003 | P0 | Status is never communicated by colour alone. |
| NFR-A11Y-004 | P1 | Touch targets ≥ 44×44 px. |
| NFR-A11Y-005 | P1 | Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI boundaries. |
| NFR-A11Y-006 | P1 | `prefers-reduced-motion` respected. |
| NFR-A11Y-007 | P1 | Alerts and errors are announced with correct live-region semantics. |
| NFR-A11Y-008 | P1 | All form controls have programmatic labels and accessible error messages. |
| NFR-OBS-001 | P1 | Structured JSON logs with request IDs, no PII. |
| NFR-OBS-002 | P1 | Traces and metrics via OpenTelemetry (traces/metrics only; logs stay stdout). |
| NFR-OBS-003 | P1 | Scheduler, notification, alert and auth failures are individually observable. |
| NFR-OBS-004 | P1 | `/api/health` distinguishes liveness from readiness. |
| NFR-OBS-005 | P2 | Documented SLO-ish signals with alert thresholds for the operator (OPERATIONS.md). |
| NFR-OBS-006 | P1 | Observability never records household content. |
| NFR-OBS-007 | P2 | Traces sample at a rate appropriate to household-scale traffic. |
| NFR-OBS-008 | P1 | Every request has a correlation id propagated through logs and traces. |
| NFR-REL-001 | P0 | Nightly database backup with a tested restore procedure. |
| NFR-REL-002 | P0 | Migrations are forward-only, reviewed, and applied before deployment. |
| NFR-REL-003 | P1 | Deploys are reversible to the previous image within 10 minutes. |
| NFR-REL-004 | P1 | A failed scheduler run is retried and does not corrupt state. |
| NFR-REL-005 | P2 | Target availability 99% monthly (household scale, maintenance windows allowed). |
| NFR-MAINT-001 | P0 | One developer can run and maintain the system (see ARCHITECTURE.md audit). |
| NFR-MAINT-002 | P0 | No circular dependencies between domain modules. |
| NFR-MAINT-003 | P1 | Every task in TASKS.md references requirement, ADR, and design docs. |
| NFR-MAINT-004 | P1 | Design tokens and status semantics are centralised. |
| NFR-MAINT-005 | P2 | Dependency upgrades are reviewed quarterly (OPERATIONS.md). |

## 7. Success signals (household-scale, qualitative first)

| Signal | How we would know |
| --- | --- |
| Members use it without being asked | A member completes a chore from the dashboard without an admin reminder. |
| Alerts are trusted | Alerts are acknowledged rather than ignored; unacknowledged `URGENT` alerts trend to zero. |
| Supplies stop surprising | Fewer "we're out of X" events attributable to a missed low-mark. |
| Maintenance happens on time | `MAINTENANCE_DUE` completions occur before `MAINTENANCE_OVERDUE`. |
| Setup is finite | A new household reaches a useful dashboard with ≤ 10 rooms, ≤ 15 chores, ≤ 10 resources, ≤ 6 maintenance plans. |

Explicitly rejected metrics: number of chores per member (creates scorekeeping), session length, streaks.

## 8. Assumptions & open questions

| ID | Item | Status |
| --- | --- | --- |
| A-1 | One household per user in v1 | Assumed; revisit only if real multi-home users appear |
| A-2 | Household timezone is a single value | Assumed; per-member display override is a P2 |
| A-3 | Photos are optional everywhere | Assumed; no flow requires a camera |
| A-4 | Email is optional in v1 (invite links can be shared manually) | Assumed; affects FR-NOTIF-003 and FR-MEM-003 |
| Q-1 | Should `HELPER` see the full history or only today? | Open — decide in VS-1 design review |
| Q-2 | Are rooms required for chores? | Resolved: optional (FR-CHORE-001) |
| Q-3 | Vendor contact storage: free text vs structured? | Resolved: free text (NG-5) |

## 9. Requirement → document map

| Area | Primary documents |
| --- | --- |
| Household, members, auth | ADR-004, ADR-005, SECURITY.md, docs/security/AUTHZ-MATRIX.md |
| Rooms | docs/product/ROOMS.md, ADR-010 |
| Chores & recurrence | docs/product/CHORES.md, docs/product/RECURRENCE.md, ADR-006, ADR-007 |
| Trash | docs/product/TRASH.md, ADR-008 |
| Resources & shopping | docs/product/RESOURCES.md, ADR-011 |
| Maintenance & assets | docs/product/MAINTENANCE.md, ADR-012 |
| Issues | docs/product/ISSUES.md |
| Alerts & notifications | docs/product/ALERTS.md, docs/product/NOTIFICATIONS.md, ADR-008, ADR-009 |
| Dashboard | docs/product/DASHBOARD.md, PERFORMANCE.md |
| Activity | docs/product/ACTIVITY.md, PRIVACY.md |
| PWA | ADR-014, docs/research/STACK-2026.md#9 |
| Scheduling, jobs, idempotency | ADR-013, NFR-REL-004, docs/operations/MONITORING.md |
| Deployment, migrations, rollback | ADR-016, DEPLOYMENT.md, docs/operations/BACKUP-RESTORE.md |
| Everything | docs/TRACEABILITY.md |

## 10. Traceability rule

Any change to a requirement in this document invalidates the corresponding row in `docs/TRACEABILITY.md` and must be accompanied by a DECISIONS.md entry. Documents and skeletons in this repository describe **planned** behaviour only; nothing here is implemented.
