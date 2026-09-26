# API.md — Planned Operation Boundaries

> 2026-09-26 · Status: **DESIGNED, NOT IMPLEMENTED** · No route, action, or query exists in this phase.
> HomeOps has **no public API**. "API" here means the server-side operation surface: Next.js Server Actions (primary, for mutations from our own UI) and route handlers (health, scheduler trigger, push subscription, attachment streaming).
> Conventions and envelope rules: docs/api/CONVENTIONS.md · Error taxonomy: docs/api/ERROR-CATALOG.md · Authorization roles: docs/security/AUTHZ-MATRIX.md.

## 1. Operation surface at a glance

| Kind | Mechanism | Used for | Auth |
| --- | --- | --- | --- |
| Server Action `mutate*` | `"use server"` function called from a form/component | All user-initiated writes | Session + household context + role check |
| Server Action `read*` (rare) | Called from client components for refresh | Small targeted refreshes | Session + context |
| Server Component data load | Direct function call in RSC | All page reads | Session + context |
| Route handler `GET` | `/api/...` | Health, attachment streaming | Varies (health: none; attachments: session + context) |
| Route handler `POST` | `/api/...` | Push subscribe/unsubscribe, scheduler trigger | Session (push) / shared secret (scheduler) |

Common envelope for every operation (docs/api/CONVENTIONS.md):

```ts
type OperationResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: { code: DomainErrorCode; message: string; field?: string; correlationId: string } };
```

Never throw raw errors across the boundary; never return internal detail. Errors are values and are mapped from the catalogue (docs/api/ERROR-CATALOG.md).

## 2. Household & membership

### 2.1 Identity and access

| Operation | Req | Purpose | Caller | Authentication | Authorization |
| --- | --- | --- | --- | --- | --- |
| `createHousehold` | FR-HH-001, FR-HH-002 | Create the household; creator becomes `OWNER` | Signed-in user without a household | Required | Any authenticated user with no existing household (FR-HH-005) |
| `updateHouseholdSettings` | FR-HH-007, FR-SET-006 | Rename, timezone, week start, thresholds, quiet hours | Settings page | Required | `OWNER`, `ADMIN` |
| `archiveHousehold` | FR-HH-010 | Make household read-only | Settings page | Required | `OWNER` only (re-auth recommended) |
| `inviteMember` | FR-MEM-003 | Create an invitation (email or shareable link) | Members page | Required | `OWNER`, `ADMIN` |
| `revokeInvitation` | FR-MEM-003 | Invalidate an invitation | Members page | Required | `OWNER`, `ADMIN` |
| `acceptInvitation` | FR-MEM-004 | Join a household via token | Public invite page | Session required (sign-up inline if needed) | Token must be valid, unused, unexpired |
| `changeMemberRole` | FR-MEM-002, FR-MEM-008 | Change role / transfer ownership | Members page | Required | `OWNER` (role change to/from `OWNER`), else `ADMIN` |
| `removeMember` | FR-MEM-006 | Remove a member; kill sessions + subscriptions | Members page | Required | `OWNER`, `ADMIN`; cannot remove last `OWNER` |
| `leaveHousehold` | FR-MEM-007 | Voluntarily leave | Settings page | Required | Any member except last `OWNER` |
| `setAwayPeriod` | FR-MEM-009 | Mark away window (recipient selection) | Settings page | Required | Self; `OWNER`/`ADMIN` for others |
| `updateProfile` | FR-MEM-005 | Display name, avatar colour, theme, motion | Settings page | Required | Self |

**Inputs / outputs / rules (2.1)**

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `createHousehold` | `{name, timezone, weekStartsOn?}` → `{householdId}` | name 1–60 chars; timezone ∈ IANA set; week start enum | `VALIDATION_*`, `HOUSEHOLD_ALREADY_EXISTS` (FR-HH-005) | Natural (409 if already a member) | 5/hour/user |
| `updateHouseholdSettings` | `{name?, timezone?, weekStartsOn?, thresholds?, quietHours?}` → `{updated}` | ranges for lead times (0–90 d), cap (1–20), TTL | `FORBIDDEN` (role), `VALIDATION_RANGE`, `HOUSEHOLD_ARCHIVED` | Idempotent (patch) | 30/hour |
| `archiveHousehold` | `{confirmName}` → `{archived}` | typed confirmation string must match name | `FORBIDDEN`, `VALIDATION_MISMATCH` | Idempotent | 3/day |
| `inviteMember` | `{email?, role, expiresInDays?}` → `{invitationId, inviteUrl, expiresAt}` | email format if provided; role ∈ {ADMIN, MEMBER, HELPER}; expiry ≤ 30 d | `FORBIDDEN`, `VALIDATION_EMAIL`, `MEMBER_LIMIT_REACHED` (soft cap 20) | Creates new token per call (not idempotent by design; UI prevents double-submit) | 20/day/household |
| `revokeInvitation` | `{invitationId}` → `{revoked}` | belongs to household | `NOT_FOUND`, `FORBIDDEN` | Idempotent | 60/hour |
| `acceptInvitation` | `{token, displayName?}` → `{householdId, role}` | token hash lookup; single use; not expired; household not archived | `INVITE_INVALID`, `INVITE_EXPIRED`, `INVITE_USED`, `HOUSEHOLD_ARCHIVED` | Idempotent per token (second use → `INVITE_USED`) | 10/hour/IP + 5/hour/account |
| `changeMemberRole` | `{memberId, role}` → `{updated}` | role enum; ≥1 owner maintained | `FORBIDDEN`, `LAST_OWNER`, `NOT_FOUND` | Idempotent | 30/hour |
| `removeMember` | `{memberId, reason?}` → `{removed, reassigned: {occurrences, issues}}` | cannot remove self if last owner | `LAST_OWNER`, `FORBIDDEN`, `NOT_FOUND` | Idempotent | 30/hour |
| `leaveHousehold` | `{}` → `{left}` | not last owner | `LAST_OWNER` | Idempotent | 5/day |
| `setAwayPeriod` | `{memberId, from, to}` → `{set}` | `to > from`; ≤ 180 d | `VALIDATION_RANGE`, `FORBIDDEN` | Idempotent | 30/hour |
| `updateProfile` | `{displayName?, avatarColor?, theme?, prefersReducedMotion?}` → `{updated}` | colour from token palette; name 1–40 chars | `VALIDATION_*` | Idempotent | 60/hour |

### 2.2 Authentication (delegated to the auth library; boundaries listed)

| Operation | Req | Purpose | Caller | Authentication | Authorization |
| --- | --- | --- | --- | --- | --- |
| `signUp` | FR-AUTH-001 | Create an account | Public | None | None |
| `signIn` | FR-AUTH-001 | Create a session | Public | None | None |
| `signOut` | FR-AUTH-006 | Revoke current session | Anywhere | Required | Self |
| `signOutAllDevices` | FR-AUTH-006 | Revoke all sessions | Settings | Required | Self (re-auth) |
| `requestPasswordReset` | FR-AUTH-007 | Start recovery | Public | None | None |
| `resetPassword` | FR-AUTH-007 | Consume a one-time token | Public | None | Valid single-use token |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `signUp` | `{email, password, displayName?}` → `{session}` | password policy (≥ 12 chars, breach-list check optional); email normalised | `VALIDATION_PASSWORD`, `AUTH_EMAIL_TAKEN` | 409 on duplicate | 5/hour/IP |
| `signIn` | `{email, password}` → `{session}` | — | `AUTH_INVALID_CREDENTIALS` (never reveal which field), `RATE_LIMITED` | — | 10/15 min/IP + 5/15 min/account |
| `signOut` / `signOutAllDevices` | `{}` → `{ok}` | — | — | Idempotent | 20/hour |
| `requestPasswordReset` | `{email}` → `{ok}` (always ok — no enumeration) | email format | never reveals existence | Idempotent-ish | 5/hour/IP |
| `resetPassword` | `{token, password}` → `{ok}` | token single-use, ≤ 30 min | `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED` | Token consumption idempotent | 10/hour/IP |

## 3. Rooms

| Operation | Req | Purpose | Caller | Authn | Authz |
| --- | --- | --- | --- | --- | --- |
| `createRoom` | FR-ROOM-001 | Add a room | Rooms page | Required | `OWNER`, `ADMIN`, `MEMBER` |
| `updateRoom` | FR-ROOM-007 | Rename, regroup, reorder, mark not-in-use | Room detail | Required | same as above |
| `archiveRoom` | FR-ROOM-005 | Archive without deleting history | Room detail | Required | `OWNER`, `ADMIN` |
| `setRoomStatusOverride` | FR-ROOM-004 | Set an expiring manual status | Room detail / dashboard card | Required | any member |
| `clearRoomStatusOverride` | FR-ROOM-004 | Remove the override | Room detail | Required | any member |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `createRoom` | `{name, group?, sortOrder?}` → `{roomId}` | name 1–40; unique per household (case-insensitive) | `ROOM_NAME_TAKEN`, `VALIDATION_LENGTH`, `HOUSEHOLD_LIMIT` (soft 50) | 409 on duplicate | 60/hour |
| `updateRoom` | `{roomId, name?, group?, sortOrder?, notInUse?}` → `{updated}` | same as create | `NOT_FOUND`, `VALIDATION_*` | Idempotent | 120/hour |
| `archiveRoom` | `{roomId, reassignChoresTo?}` → `{archived, affectedOccurrences}` | if open occurrences exist, either reassign or accept room-less | `ROOM_HAS_OPEN_WORK` (soft warning, allowed with flag) | Idempotent | 20/hour |
| `setRoomStatusOverride` | `{roomId, status, ttl: '3h'\|'tonight'\|'until_tomorrow'\|'custom', note?}` → `{override}` | status ∈ {CLEAN, NEEDS_ATTENTION, DIRTY, CLEANING}; ttl ≤ household max | `VALIDATION_ENUM`, `ROOM_ARCHIVED` | Replacing an override is idempotent per room | 120/hour |
| `clearRoomStatusOverride` | `{roomId}` → `{cleared}` | — | `NOT_FOUND` | Idempotent | 120/hour |

> Room **status is derived** (ADR-010); there is no "set status" for the derived value. Only overrides are writable.

## 4. Chores

| Operation | Req | Purpose | Caller | Authn | Authz |
| --- | --- | --- | --- | --- | --- |
| `createChoreDefinition` | FR-CHORE-001, 003 | Create a routine (with optional recurrence) | Chores page | Required | any member; `HELPER` may not create recurring definitions (documented decision, Q-1) |
| `updateChoreDefinition` | FR-CHORE-001, 018 | Edit/pause | Chore detail | Required | creator, assignee, `OWNER`, `ADMIN` |
| `archiveChoreDefinition` | FR-CHORE-019 | Archive, keep history | Chore detail | Required | `OWNER`, `ADMIN` |
| `createAdHocOccurrence` | FR-CHORE-010 | One-off task | Dashboard/chores | Required | any member |
| `completeChoreOccurrence` | FR-CHORE-004, 005, 006 | **One-tap completion** | Dashboard/chore detail | Required | assignee or any member (helper may complete own) |
| `skipChoreOccurrence` | FR-CHORE-007 | Skip with reason | Chore detail | Required | assignee, `OWNER`, `ADMIN` |
| `snoozeChoreOccurrence` | FR-CHORE-009 | Bounded deferral | Chore detail | Required | assignee or any member |
| `assignChoreOccurrence` | FR-CHORE-008 | Reassign/claim | Chore detail | Required | any member |
| `reopenChoreCompletion` | FR-CHORE-005 | Undo a mistaken completion (recorded) | Chore detail | Required | completer, `OWNER`, `ADMIN`; within 24 h |
| `materialiseOccurrences` | FR-CHORE-015, 017 | Ensure the next open occurrence exists | Scheduler | Job context (no session) | System |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `createChoreDefinition` | `{title, description?, roomId?, priority?, assigneeId?, recurrence?, estimatedMinutes?}` → `{definitionId}` | title 1–80; recurrence validated against the closed union; anchor date not in the past for `EVERY_N_*` | `CHORE_RECURRENCE_INVALID`, `VALIDATION_*`, `ROOM_NOT_FOUND` | Creates one definition per call | 60/hour |
| `updateChoreDefinition` | `{definitionId, patch}` → `{updated, openOccurrenceAffected}` | same; changing recurrence does not rewrite existing occurrences | `CHORE_DEFINITION_ARCHIVED`, `VALIDATION_*` | Idempotent patch | 120/hour |
| `archiveChoreDefinition` | `{definitionId, cancelOpenOccurrence}` → `{archived}` | — | `NOT_FOUND` | Idempotent | 20/hour |
| `createAdHocOccurrence` | `{title, roomId?, priority?, dueDate?, assigneeId?}` → `{occurrenceId}` | dueDate ≥ today (household tz) or explicit "no date" | `VALIDATION_DATE_PAST` | Creates one occurrence per call | 120/hour |
| `completeChoreOccurrence` | `{occurrenceId, note?, photoId?, clientRequestId}` → `{completed, activityId, alertsResolved[]}` | occurrence open; photo belongs to household; note ≤ 500 chars | `CHORE_OCCURRENCE_NOT_OPEN`, `CHORE_ALREADY_COMPLETED` (idempotent-friendly), `ATTACHMENT_INVALID` | **Yes** — `clientRequestId` + one active completion per occurrence | 240/hour |
| `skipChoreOccurrence` | `{occurrenceId, reason}` → `{skipped}` | reason required (enum + optional note) | `CHORE_OCCURRENCE_NOT_OPEN` | Yes (second call → `CHORE_ALREADY_SKIPPED`) | 120/hour |
| `snoozeChoreOccurrence` | `{occurrenceId, until: '1h'\|'tonight'\|'tomorrow'\|'weekend'\|isoDate}` → `{snoozedTo}` | within household max snooze horizon; cannot snooze past a completion | `CHORE_SNOOZE_TOO_FAR`, `VALIDATION_DATE` | Yes | 120/hour |
| `assignChoreOccurrence` | `{occurrenceId, memberId \| null}` → `{assignee}` | member active in household, not removed | `MEMBER_NOT_FOUND`, `MEMBER_REMOVED` | Yes | 240/hour |
| `reopenChoreCompletion` | `{occurrenceId, reason}` → `{reopened}` | within 24 h; actor is completer/owner/admin | `CHORE_REOPEN_WINDOW`, `FORBIDDEN` | Yes | 20/hour |
| `materialiseOccurrences` | `{householdId, horizonDays}` → `{created[]}` | single-flight lock held; horizon ≤ 30 d | `SCHEDULER_LOCK_HELD` | **Yes** (unique `occurrence_key`) | System-only (secret header) |

## 5. Trash

| Operation | Req | Purpose | Caller | Authn | Authz |
| --- | --- | --- | --- | --- | --- |
| `createTrashContainer` | FR-TRASH-001 | Add a container | Trash page | Required | any member |
| `updateTrashContainer` | FR-TRASH-001, 007 | Rename, kind, location, schedule | Trash page | Required | any member |
| `markTrashAlmostFull` | FR-TRASH-003, 008 | State transition | Dashboard/trash | Required | any member |
| `markTrashFull` | FR-TRASH-003 | State transition + alert | Dashboard/trash | Required | any member |
| `assignTrashCollection` | FR-TRASH-004 | Commit someone to collect | Trash page | Required | any member (claim = self-assign) |
| `completeTrashCollection` | FR-TRASH-005 | Record collection, reset state, resolve alerts | Dashboard/trash | Required | assignee or any member |
| `resetTrashState` | FR-TRASH-003 | Manually return to `EMPTY`/`AVAILABLE` | Trash page | Required | any member |
| `archiveTrashContainer` | FR-TRASH-009 | Archive keeping history | Trash page | Required | `OWNER`, `ADMIN` |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `createTrashContainer` | `{name, kind, locationNote?}` → `{containerId}` | unique name per household | `TRASH_NAME_TAKEN` | 409 duplicate | 30/hour |
| `updateTrashContainer` | `{containerId, patch}` → `{updated}` | schedule weekdays 0–6; window ordering | `NOT_FOUND`, `VALIDATION_*` | Idempotent | 60/hour |
| `markTrashAlmostFull` / `markTrashFull` | `{containerId, clientRequestId}` → `{state, alertId?}` | legal transition per the state graph (I-TRASH-001) | `TRASH_INVALID_TRANSITION`, `TRASH_ALREADY_FULL` | Yes (`clientRequestId`; repeated same-state call is a no-op) | 120/hour |
| `assignTrashCollection` | `{containerId, memberId, dueAt?}` → `{assigned}` | member active | `MEMBER_NOT_FOUND` | Yes | 60/hour |
| `completeTrashCollection` | `{containerId, note?, clientRequestId}` → `{state: 'EMPTY', alertsResolved[]}` | container not archived | `TRASH_CONTAINER_ARCHIVED`, `TRASH_COLLECTION_DUPLICATE` (idempotent-friendly) | **Yes** (`clientRequestId` + latest-collection window) | 120/hour |
| `resetTrashState` | `{containerId, to: 'EMPTY'\|'AVAILABLE', reason?}` → `{state}` | reason required when resetting from `FULL` | `VALIDATION_REQUIRED` | Yes | 60/hour |
| `archiveTrashContainer` | `{containerId}` → `{archived}` | resolves open alerts for the container | `NOT_FOUND` | Yes | 20/hour |

## 6. Resources & shopping

| Operation | Req | Purpose | Caller | Authn | Authz |
| --- | --- | --- | --- | --- | --- |
| `createResource` | FR-RES-001, 002 | Add a consumable with a quantity mode | Resources page | Required | any member |
| `updateResource` | FR-RES-005, 006, 011 | Thresholds, target, room, notes | Resource detail | Required | any member |
| `changeResourceMode` | FR-RES-002 | Switch quantity mode (explicit, resets level) | Resource detail | Required | `OWNER`, `ADMIN` |
| `setResourceLevel` | FR-RES-004 | Set level (mode-specific) | Dashboard/resources | Required | any member |
| `recordResourceUsed` | FR-RES-004 | "Used one" / −1 quick action | Dashboard/resources | Required | any member |
| `recordResourceRestock` | FR-RES-008 | Restock → level to target, close need | Dashboard/resources | Required | any member |
| `addShoppingItem` | FR-SHOP-002 | Manual addition | Resources/shopping | Required | any member |
| `markShoppingItemBought` | FR-SHOP-003 | Bought → update linked resource | Shopping | Required | any member |
| `removeShoppingItem` | FR-SHOP-002 | Remove (not bought) | Shopping | Required | any member |
| `exportShoppingListText` | FR-SHOP-004 | Copy as plain text | Shopping | Required | any member |
| `archiveResource` | FR-RES-012 | Archive keeping history | Resource detail | Required | `OWNER`, `ADMIN` |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `createResource` | `{name, mode, unit?, category?, roomId?, target?, low?, critical?}` → `{resourceId}` | mode-consistent fields (no unit for APPROXIMATE); `critical ≤ low ≤ target` where applicable | `RESOURCE_MODE_MISMATCH`, `VALIDATION_*`, `RESOURCE_NAME_TAKEN` | 409 duplicate | 60/hour |
| `updateResource` | `{resourceId, patch}` → `{updated}` | same consistency rules | `VALIDATION_*`, `NOT_FOUND` | Idempotent | 120/hour |
| `changeResourceMode` | `{resourceId, mode, confirmLevel}` → `{updated}` | explicit confirmation; level reset recorded | `RESOURCE_MODE_MISMATCH` | Yes (second call with same mode → no-op) | 20/hour |
| `setResourceLevel` | `{resourceId, level \| quantity, clientRequestId}` → `{level, restockNeed?}` | level valid for mode; `quantity ≥ 0` | `RESOURCE_LEVEL_INVALID`, `RESOURCE_ARCHIVED` | **Yes** (`clientRequestId`) | 240/hour |
| `recordResourceUsed` | `{resourceId, amount?: n}` → `{level}` | `EXACT`: n ≥ 1 and ≤ current; others: step down one level | `RESOURCE_LEVEL_INVALID` | Yes (clientRequestId; clamp at floor) | 240/hour |
| `recordResourceRestock` | `{resourceId, quantity?, note?, clientRequestId}` → `{level, alertsResolved[]}` | sets to target/full/available | `RESOURCE_ARCHIVED` | **Yes** | 120/hour |
| `addShoppingItem` / `removeShoppingItem` | `{label, quantityHint?, resourceId?}` → `{itemId}` | label 1–80 | `VALIDATION_LENGTH` | Creates one item per call | 120/hour |
| `markShoppingItemBought` | `{itemId, updateResource?}` → `{bought, resourceLevel?}` | linked resource exists and not archived | `NOT_FOUND`, `RESOURCE_ARCHIVED` | Yes | 120/hour |
| `exportShoppingListText` | `{}` → `{text}` | — | — | Read-only | 30/hour |
| `archiveResource` | `{resourceId}` → `{archived}` | closes open needs | `NOT_FOUND` | Yes | 20/hour |

## 7. Maintenance & assets

| Operation | Req | Purpose | Caller | Authn | Authz |
| --- | --- | --- | --- | --- | --- |
| `createAsset` / `updateAsset` / `archiveAsset` | FR-MNT-001 | Register and maintain assets | Maintenance page | Required | any member (archive: `OWNER`/`ADMIN`) |
| `createMaintenancePlan` | FR-MNT-002, 003 | Plan with frequency + lead time | Maintenance page | Required | any member |
| `updateMaintenancePlan` | FR-MNT-002, 006, 009 | Edit, assign, pause | Plan detail | Required | any member |
| `recordMaintenanceService` | FR-MNT-005 | **Complete a service** (≤3 fields) | Plan card | Required | any member |
| `linkIssueToMaintenance` | FR-MNT-011 | Reference an originating issue | Plan/service | Required | any member |
| `computeMaintenanceDue` | FR-MNT-007 | Recompute due/overdue + alerts | Scheduler | Job context | System |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `createAsset` | `{name, category, roomId?, locationNote?, installedAt?}` → `{assetId}` | name 1–60; category enum; installedAt not in future | `VALIDATION_*`, `ASSET_NAME_TAKEN` | 409 duplicate | 40/hour |
| `createMaintenancePlan` | `{assetId?, title, frequency, leadTimeDays?, assigneeId?, vendorNote?, estimatedCost?}` → `{planId}` | frequency validated (N ≥ 1); lead 0–90; cost ≥ 0 | `MNT_FREQUENCY_INVALID`, `VALIDATION_RANGE` | Creates one plan per call | 40/hour |
| `updateMaintenancePlan` | `{planId, patch}` → `{updated, nextServiceAt}` | pause requires `pausedReason?` | `NOT_FOUND`, `VALIDATION_*` | Idempotent | 120/hour |
| `recordMaintenanceService` | `{planId?, assetId?, performedBy: memberId \| 'EXTERNAL', completedAt?, vendorNote?, costNote?, notes?, clientRequestId}` → `{recordId, nextServiceAt}` | `completedAt` ≤ now + 1 day; at least one of plan/asset | `MNT_NO_TARGET`, `VALIDATION_DATE_FUTURE` | **Yes** (`clientRequestId`) | 60/hour |
| `linkIssueToMaintenance` | `{issueId, planId}` → `{linked}` | both in household | `NOT_FOUND` | Yes | 60/hour |
| `computeMaintenanceDue` | `{householdId}` → `{due[], overdue[]}` | lock held | `SCHEDULER_LOCK_HELD` | Yes (recomputable) | System-only |

## 8. Issues

| Operation | Req | Purpose | Caller | Authn | Authz |
| --- | --- | --- | --- | --- | --- |
| `reportIssue` | FR-ISSUE-001, 002 | **Report in ≤20 s** (title + optional photo) | Dashboard/issues | Required | any member (incl. `HELPER`) |
| `acknowledgeIssue` | FR-ISSUE-003, 007 | State transition, stops escalation | Issue detail | Required | any member |
| `startIssueProgress` | FR-ISSUE-003 | Mark in progress | Issue detail | Required | assignee or any member |
| `assignIssue` | FR-ISSUE-005 | Assign to member | Issue detail | Required | any member |
| `resolveIssue` | FR-ISSUE-003, 009 | Resolve with optional follow-up task | Issue detail | Required | assignee, `OWNER`, `ADMIN` |
| `closeIssue` | FR-ISSUE-003 | Close after verification | Issue detail | Required | reporter, `OWNER`, `ADMIN` |
| `markIssueWontFix` | FR-ISSUE-003 | Terminal alternative | Issue detail | Required | `OWNER`, `ADMIN` |
| `addIssueComment` | FR-ISSUE-008 | Short update text | Issue detail | Required | any member |
| `attachIssuePhoto` | FR-ISSUE-001, 008 | Add a photo (optional) | Issue detail | Required | any member |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `reportIssue` | `{title, description?, roomId?, assetId?, severity?, photoId?, clientRequestId}` → `{issueId, alertId?}` | title 1–80; description ≤ 2000; severity enum; photo ownership | `VALIDATION_*`, `ATTACHMENT_INVALID` | **Yes** (`clientRequestId`) | 60/hour |
| `acknowledgeIssue` / `startIssueProgress` | `{issueId, clientRequestId}` → `{status}` | legal transition | `ISSUE_INVALID_TRANSITION` | Yes | 120/hour |
| `assignIssue` | `{issueId, memberId}` → `{assignee}` | member active | `MEMBER_NOT_FOUND` | Yes | 120/hour |
| `resolveIssue` | `{issueId, note?, createFollowUp?: {kind: 'CHORE'\|'MAINTENANCE', ...}}` → `{status, followUpId?}` | legal transition; follow-up fields validated by target module | `ISSUE_INVALID_TRANSITION`, `VALIDATION_*` | Yes | 60/hour |
| `closeIssue` / `markIssueWontFix` | `{issueId, reason?}` → `{status}` | `WONT_FIX` requires reason | `ISSUE_INVALID_TRANSITION`, `VALIDATION_REQUIRED` | Yes | 60/hour |
| `addIssueComment` | `{issueId, body}` → `{commentId}` | body 1–1000 | `VALIDATION_LENGTH`, `ISSUE_CLOSED_READONLY` (closed issues accept no new comments) | Creates one comment per call (double-submit guarded by UI) | 120/hour |
| `attachIssuePhoto` | `{issueId, uploadId}` → `{attachmentId}` | mime ∈ {jpeg, png, webp/heic converted}; ≤ 5 MB; ≤ 5 per issue | `ATTACHMENT_TYPE`, `ATTACHMENT_TOO_LARGE`, `ATTACHMENT_LIMIT` | Yes per upload id | 40/hour |

## 9. Alerts

| Operation | Req | Purpose | Caller | Authn | Authz |
| --- | --- | --- | --- | --- | --- |
| `acknowledgeAlert` | FR-ALERT-007 | Take ownership, stop escalation | Dashboard/alerts | Required | intended recipient or `OWNER`/`ADMIN` |
| `snoozeAlert` | FR-ALERT-008 | Bounded deferral | Dashboard/alerts | Required | intended recipient or `OWNER`/`ADMIN` |
| `resolveAlert` | FR-ALERT-009 | Manual resolution when auto-resolution is impossible | Alert detail | Required | intended recipient or `OWNER`/`ADMIN` |
| `reassignAlert` | FR-ALERT-010 | Point the alert at another member | Alert detail | Required | any member |
| `evaluateAlertsForHousehold` | FR-ALERT-005, 009 | Recompute desired alerts (create/refresh/auto-resolve) | Scheduler | Job context | System |
| `explainAlert` | FR-ALERT-014 | Return the "why did I get this" text | Alert detail | Required | recipient or any member |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `acknowledgeAlert` | `{alertId, clientRequestId}` → `{state}` | alert is `OPEN` or `SNOOZED` | `ALERT_TERMINAL`, `NOT_FOUND` | **Yes** (repeat → same state) | 240/hour |
| `snoozeAlert` | `{alertId, until}` → `{snoozedUntil}` | ≤ household max snooze horizon (default 24 h) | `ALERT_SNOOZE_TOO_FAR`, `ALERT_TERMINAL` | Yes | 240/hour |
| `resolveAlert` | `{alertId, reason}` → `{state, conditionStillPresent?}` | reason required; warns if the condition is still detected | `ALERT_TERMINAL`, `VALIDATION_REQUIRED` | Yes | 120/hour |
| `reassignAlert` | `{alertId, memberId}` → `{recipient}` | member active, not away (or `URGENT`) | `MEMBER_NOT_FOUND` | Yes | 120/hour |
| `evaluateAlertsForHousehold` | `{householdId}` → `{created[], refreshed[], resolved[]}` | lock held; deterministic keys | `SCHEDULER_LOCK_HELD` | **Yes** (dedupe keys) | System-only |
| `explainAlert` | `{alertId}` → `{type, priority, priorityReason, condition, recipientReason}` | — | `NOT_FOUND` | Read-only | 120/hour |

## 10. Notifications & preferences

| Operation | Req | Purpose | Caller | Authn | Authz |
| --- | --- | --- | --- | --- | --- |
| `updateNotificationPreference` | FR-NOTIF-004, 005 | Channel matrix, quiet hours, cap | Settings | Required | self |
| `registerPushSubscription` | FR-NOTIF-007, FR-PWA-003 | Store an endpoint for a device | Settings (post-permission) | Required | self |
| `removePushSubscription` | FR-NOTIF-007 | Remove a device | Settings | Required | self |
| `testNotification` | FR-NOTIF-004 | Send a test on the chosen channel | Settings | Required | self; 3/day |
| `dispatchNotifications` | FR-NOTIF-006, 008 | Drain intents and deliver | Scheduler | Job context | System |
| `pruneDeliveries` | FR-NOTIF-006 | Retention of intents/attempts | Scheduler | Job context | System |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `updateNotificationPreference` | `{matrix, quietHours?, dailyCap?}` → `{updated}` | channels ∈ registry; quiet window valid; cap 1–20 | `VALIDATION_ENUM`, `VALIDATION_RANGE` | Idempotent | 60/hour |
| `registerPushSubscription` | `{endpoint, keys:{p256dh, auth}, userAgent?}` → `{subscriptionId}` | endpoint URL https; keys non-empty; endpoint hash unique (replaces) | `VALIDATION_*`, `PUSH_UNSUPPORTED` | Yes per endpoint hash | 20/hour |
| `removePushSubscription` | `{subscriptionId}` → `{removed}` | self-owned | `NOT_FOUND` | Yes | 60/hour |
| `testNotification` | `{channel}` → `{delivered: boolean, failureReason?}` | channel enabled | `NOTIF_CHANNEL_DISABLED` | Not idempotent (intentionally traceable) | 3/day |
| `dispatchNotifications` | `{batchSize?}` → `{delivered, suppressed, failed}` | batch ≤ 200; lock held | `SCHEDULER_LOCK_HELD` | **Yes** (intent uniqueness + attempt dedupe) | System-only |
| `pruneDeliveries` | `{olderThanDays?}` → `{pruned}` | ≥ 30 days | — | Yes | System-only |

## 11. Activity, dashboard & settings reads

| Operation | Req | Purpose | Caller | Authn | Authz |
| --- | --- | --- | --- | --- | --- |
| `getDashboardSnapshot` | FR-DASH-001, 006 | Compose the dashboard read model | `/today` RSC | Required | any member |
| `listActivity` | FR-ACT-003 | Filterable history (keyset paginated) | `/activity` | Required | any member |
| `getEntityHistory` | FR-ACT-004 | Per-entity recent history | Detail pages | Required | any member |
| `getRoomDetail` | FR-ROOM-003, 006 | Room state + reason + related work | Room detail | Required | any member |
| `exportHouseholdData` | FR-SET-005, NFR-PRIV-005 | JSON export of household data | Settings | Required | `OWNER` only (re-auth) |
| `requestHouseholdDeletion` | NFR-PRIV-005 | Opens an operator-verified deletion request | Settings | Required | `OWNER` only |

| Operation | Input → Output | Validation | Errors | Idempotency | Rate limit |
| --- | --- | --- | --- | --- | --- |
| `getDashboardSnapshot` | `{householdId (from ctx), timezone}` → `DashboardSnapshot` | — | `INTERNAL_*` mapped to a friendly error | Read-only | 600/hour |
| `listActivity` | `{type?, memberId?, roomId?, from?, to?, cursor?, limit ≤ 50}` → `{items, nextCursor}` | cursor opaque; range ≤ 180 days | `VALIDATION_RANGE` | Read-only | 300/hour |
| `getEntityHistory` | `{entityType, entityId, limit ≤ 20}` | entity in household | `NOT_FOUND` | Read-only | 300/hour |
| `exportHouseholdData` | `{}` → `{downloadUrl, expiresAt}` | re-auth within 5 min | `AUTH_REQUIRED`, `FORBIDDEN` | One export per 24 h | 1/day |
| `requestHouseholdDeletion` | `{confirmName, reason?}` → `{requestId}` | name match | `VALIDATION_MISMATCH` | Idempotent per open request | 1/day |

## 12. System & infrastructure routes

| Operation | Method/path | Purpose | Authn | Notes |
| --- | --- | --- | --- | --- |
| Health (live) | `GET /api/health` | Process is up | None | Returns `{status:'ok', version, uptime}`; no data detail |
| Health (ready) | `GET /api/health?deep=1` | DB reachable + last scheduler tick age | None | Returns degraded status + reason code, never internals |
| Scheduler trigger | `POST /api/cron/[job]` | Run one job manually / external cron fallback | Shared secret header | Rate limited; job allow-list; single-flight lock (ADR-013) |
| Push subscribe | `POST /api/push/subscribe` | Alternative to the Server Action for SW-driven registration | Session | Same validation as the action |
| Attachment stream | `GET /api/attachments/[id]` | Serve a photo from storage | Session | Household-scoped; `Content-Disposition: inline` only for allowed types; never directory-listed |

## 13. Cross-cutting rules for all operations

| Rule | Detail |
| --- | --- |
| Context source | `householdId` is **always** derived from the session, never from input (FR-HH-004). |
| Validation | Zod parse at the boundary; unknown keys rejected; enums closed (NFR-SEC-003). |
| Authorization | Role check per docs/security/AUTHZ-MATRIX.md, server-side, before any write. |
| Idempotency | Every mutation accepts `clientRequestId` (uuid v4 from the client) and dedupes on it where the operation is user-tappable. |
| Errors | Typed codes only (docs/api/ERROR-CATALOG.md); user copy in DESIGN §11 language; internal detail logged, never returned. |
| Rate limiting | Per (operation class, actor) with a durable bucket; abuse classes: auth, invites, uploads, exports. |
| Transactions | One transaction per operation; activity + outbox writes join it; notification delivery never does (ADR-009, FR-NOTIF-008). |
| Read limits | Every list is bounded with keyset pagination; no offset pagination on history surfaces. |
| Revalidation | Mutations declare the cache tags they invalidate (`today`, `room:<id>`, `chore:<id>`, …). |
| Observability | Each operation emits a span named `op.<module>.<action>` and a log event on failure only (OBSERVABILITY.md). |
| No operation exists in this phase | Every row above is a design; implementation is assigned in TASKS.md per slice. |
