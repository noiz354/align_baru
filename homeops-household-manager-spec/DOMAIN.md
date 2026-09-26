# DOMAIN.md — HomeOps Domain Model

> 2026-09-26 · Status: **MODELLED, NOT IMPLEMENTED** · Owner: Principal Architect
> Companion documents: docs/domain/AGGREGATES.md (aggregate boundaries), docs/domain/INVARIANTS.md (numbered invariants), docs/domain/ERRORS.md (domain error taxonomy), DATA_MODEL.md (persistence), EVENTS.md (domain events).

## 1. Model at a glance

```text
Household  (tenant root; owns every scoped record)
├── Members            (roles, away status, invitation acceptance)
├── Rooms              (identity + derived state + manual override)
├── Chores             (definitions → occurrences → completions/skips)
├── Trash              (containers → state events → collections)
├── Resources          (consumables → levels → restock needs → shopping items)
├── Assets             (things that need care)
│   └── Maintenance    (plans → service records)
├── Issues             (reported problems → lifecycle → follow-ups)
├── Alerts             (condition-derived, deduplicated, actionable)
│   └── (delivery)     → Notifications (policy + channels; NOT a domain module)
└── Activity           (append-only log of everything above)
```

## 2. Modelling principles

| ID | Principle | Consequence |
| --- | --- | --- |
| DM-1 | **Household is the only tenancy boundary.** | Every aggregate references `householdId`; ports require a context (ADR-005). |
| DM-2 | **Record facts, derive convenience.** | Completions, state events and level changes are facts; room status, alert state and `nextServiceAt` are derived. |
| DM-3 | **One concept, one owner module.** | Trash does not decide alerts; alerts do not send notifications; activity does not own data. |
| DM-4 | **Discrete state over invented scores.** | Ordinal/status values, never synthetic percentages (DP-9). |
| DM-5 | **Time is injected, never ambient.** | Domain functions take a `Clock`; storage uses UTC instants + civil dates (ADR-007). |
| DM-6 | **Idempotency is a domain property.** | Completion, collection, restock, evaluation are all safe to repeat (FR-CHORE-005, FR-TRASH-005, FR-RES-008, ADR-008). |
| DM-7 | **Smallest useful model.** | No subtasks, dependencies, approvals, or scoring anywhere. |
| DM-8 | **Human-language naming.** | Terms match the UI (GLOSSARY.md); no enterprise synonyms. |

## 3. Ubiquitous language

Defined once in GLOSSARY.md; the domain uses exactly those words. Load-bearing distinctions:

- **Chore vs maintenance**: chores are human routines scoped to rooms/people; maintenance is asset-scoped with service history (ADR-006, ADR-012).
- **Alert vs notification**: an alert is truth about the world; a notification is an interruption (ADR-008, ADR-009).
- **Definition vs occurrence vs completion**: routine, plan, and act (ADR-006).
- **Level vs threshold**: a level is what is (approximate or exact); a threshold is when to care (ADR-011).
- **Skip vs snooze vs complete**: decline now / later / done — three different records (ADR-006).

## 4. Aggregates, entities and value objects

### 4.1 Household (aggregate root · module `household`)

| Element | Kind | Notes |
| --- | --- | --- |
| `Household` | Aggregate root / entity | `id`, `name`, `timezone`, `weekStartsOn`, `createdBy`, `createdAt`, `archivedAt?` |
| `HouseholdSettings` | Entity (1:1 with household) | Lead times, alert thresholds, caps, quiet hours defaults, snooze max, room-override TTL |
| `Invitation` | Entity | `id`, `householdId`, `tokenHash`, `invitedEmail?`, `role`, `expiresAt`, `acceptedAt?`, `revokedAt?`, `createdBy` |
| `Timezone` | Value object | IANA identifier; validated on write (FR-HH-006) |
| `WeekStart` | Value object | `MONDAY` \| `SUNDAY` |

**Invariants:** exactly one household per membership set; timezone must be a valid IANA zone (I-HH-001); archived households are read-only except export/deletion (I-HH-002); quiet hours may be empty but never degenerate (I-HH-003); timezone change affects only future materialisation (I-HH-004).

### 4.2 Members (module `members`)

| Element | Kind | Notes |
| --- | --- | --- |
| `Membership` | Entity (aggregate root of this module) | `id`, `householdId`, `userId`, `role`, `displayName`, `avatarColor?`, `joinedAt`, `awayUntil?` |
| `Role` | Value object / enum | `OWNER` \| `ADMIN` \| `MEMBER` \| `HELPER` |
| `AwayPeriod` | Value object | `from`, `to` — drives recipient selection (FR-MEM-009) |
| `RecipientReason` | Value object | `ASSIGNED` \| `ROLE` \| `FALLBACK_OWNER` — why someone got an alert |

**Invariants:** ≥1 owner at all times (I-MEM-001); role changes and removals require `OWNER`/`ADMIN` (I-MEM-002); removal invalidates sessions and channel subscriptions in the same transaction (I-MEM-003); removal reassigns or unassigns open items (I-MEM-004); historical activity survives removal with a snapshotted name (I-MEM-005).

### 4.3 Rooms (module `rooms`)

| Element | Kind | Notes |
| --- | --- | --- |
| `Room` | Entity / aggregate root | `id`, `householdId`, `name`, `group?`, `sortOrder`, `archivedAt?`, `notInUse` |
| `RoomStatus` | Value object / enum | `CLEAN` \| `NEEDS_ATTENTION` \| `DIRTY` \| `CLEANING` \| `UNKNOWN` |
| `RoomStatusReason` | Value object | `{ status, source: 'MANUAL' \| 'CHORE' \| 'NONE', ruleId, evidenceRefs[] }` |
| `RoomStatusOverride` | Entity | `roomId`, `status`, `setBy`, `setAt`, `expiresAt`, `note?` |

**Invariants:** status is always one of the five, with a reason (I-ROOM-001); at most one active override per room (I-ROOM-002); derivation is pure and deterministic with the fixed precedence override → IN_PROGRESS → overdue → due today → recent completion → UNKNOWN (I-ROOM-003); a room never alerts directly (I-ROOM-004, ADR-010); not-in-use and archived rooms are excluded from derivation, lists, and alert evaluation (I-ROOM-005).

### 4.4 Chores (module `chores`)

| Element | Kind | Notes |
| --- | --- | --- |
| `ChoreDefinition` | Aggregate root | `id`, `householdId`, `roomId?`, `title`, `description?`, `priority`, `defaultAssigneeId?`, `recurrence?`, `estimatedMinutes?`, `isPaused`, `archivedAt?` |
| `ChoreOccurrence` | Entity | `id`, `definitionId`, `dueDate` (civil), `dueAt` (instant), `status`, `assigneeId?`, `snoozedTo?`, `occurrenceKey`, `source` |
| `ChoreCompletion` | Entity | `id`, `occurrenceId`, `completedById`, `completedAt`, `note?`, `attachmentId?`, `skipped`, `skipReason?` |
| `RecurrenceRule` | Value object (closed union) | `DAILY` \| `WEEKDAYS{days}` \| `EVERY_N_DAYS{n,anchor}` \| `EVERY_N_WEEKS{n,weekday}` \| `MONTHLY{dayOfMonth}` \| `EVERY_N_MONTHS{n,dayOfMonth}` \| `AFTER_COMPLETION{days\|weeks}` |
| `OccurrenceStatus` | Value object / enum | `SCHEDULED` \| `IN_PROGRESS` \| `DONE` \| `SKIPPED` \| `SNOOZED` \| `CANCELLED` |
| `ChorePriority` | Value object / enum | `LOW` \| `NORMAL` \| `HIGH` |
| `OccurrenceKey` | Value object | Deterministic idempotency key for materialisation |

**Invariants:** at most one open occurrence per definition (I-CHORE-001); completion is idempotent per occurrence (I-CHORE-002); the occurrence key is deterministic per slot and unique per household (I-CHORE-003); next dates derive from the rule anchor or last completion, never from the tick time (I-CHORE-004); skip does not advance completion-anchored series (I-CHORE-005); snooze is bounded and attributed (I-CHORE-006); definitions never delete history (I-CHORE-007).

### 4.5 Trash (module `trash`)

| Element | Kind | Notes |
| --- | --- | --- |
| `TrashContainer` | Aggregate root | `id`, `householdId`, `name`, `kind` (`GENERAL`\|`RECYCLABLE`\|`ORGANIC`\|`OTHER`), `locationNote?`, `state`, `stateChangedAt`, `assignedToId?`, `collectionSchedule?` |
| `TrashStateEvent` | Entity (append-only) | `id`, `containerId`, `from`, `to`, `actorId`, `at`, `note?` |
| `CollectionRecord` | Entity | `id`, `containerId`, `collectedById`, `collectedAt`, `note?` |
| `TrashContainerState` | Value object / enum | `EMPTY` \| `AVAILABLE` \| `ALMOST_FULL` \| `FULL` \| `COLLECTION_REQUIRED` |
| `CollectionSchedule` | Value object | weekday(s) + time window (informational + reminder driver) |

**Invariants:** state transitions follow the documented graph (I-TRASH-001); every transition writes a state event (I-TRASH-002); collection resets state and closes trash alerts (I-TRASH-003); hysteresis prevents flapping and no automatic downgrades exist (I-TRASH-004); a reset from FULL requires a reason (I-TRASH-005); an EMPTY container never produces a schedule reminder (I-TRASH-006).

### 4.6 Resources (module `resources`)

| Element | Kind | Notes |
| --- | --- | --- |
| `Resource` | Aggregate root | `id`, `householdId`, `name`, `category?`, `roomId?`, `mode`, `unit?`, `targetQuantity?`, `lowThreshold?`, `criticalThreshold?`, `restockLeadDays?`, `archivedAt?` |
| `ResourceLevel` | Entity | `resourceId`, `level`, `quantity?`, `recordedById`, `recordedAt` |
| `LevelChange` | Entity (append-only) | `id`, `resourceId`, `from`, `to`, `actorId`, `at`, `reason` |
| `QuantityMode` | Value object / enum | `EXACT` \| `APPROXIMATE` \| `AVAILABLE_UNAVAILABLE` |
| `ApproximateLevel` | Value object / enum | `FULL` \| `ENOUGH` \| `LOW` \| `CRITICAL` \| `EMPTY` |
| `RestockNeed` | Derived value object | `{ resourceId, severity: LOW\|CRITICAL, since }` |
| `ShoppingItem` | Entity | `id`, `householdId`, `resourceId?`, `label`, `quantityHint?`, `addedBy`, `addedAt`, `boughtAt?`, `boughtBy?` |

**Invariants:** levels are always interpretable in the resource's mode (I-RES-001); mode changes reset the level explicitly (I-RES-002); restock closes the need (I-RES-003); low needs are grouped into one alert per household per window (I-RES-004, see I-ALERT-001); threshold-crossing events fire on transitions only, once per direction per day (I-RES-005); target/par and thresholds are mode-consistent (I-RES-006).

### 4.7 Maintenance & assets (module `maintenance`)

| Element | Kind | Notes |
| --- | --- | --- |
| `Asset` | Aggregate root | `id`, `householdId`, `name`, `category`, `roomId?`, `locationNote?`, `notes?`, `installedAt?`, `archivedAt?` |
| `MaintenancePlan` | Entity | `id`, `householdId`, `assetId?`, `title`, `frequency`, `leadTimeDays`, `assigneeId?`, `vendorNote?`, `estimatedCost?`, `isPaused`, `lastServiceAt?`, `nextServiceAt?` |
| `MaintenanceRecord` | Entity (append-only) | `id`, `planId?`, `assetId?`, `completedById?` (null ⇒ `EXTERNAL`), `completedAt`, `vendorNote?`, `costNote?`, `notes?` |
| `MaintenanceFrequency` | Value object | `EVERY_N_DAYS` \| `EVERY_N_WEEKS` \| `EVERY_N_MONTHS` \| `EVERY_N_YEARS` \| `MONTHS_OF_YEAR{months[]}` |

**Invariants:** `nextServiceAt` is always recomputable from records (I-MNT-001); completing a service records the actor or `EXTERNAL` (I-MNT-002); paused plans produce no alerts (I-MNT-003); no work-order/approval concepts exist (I-MNT-004); monthly clamping is stable and never drifts (I-MNT-005); cost and vendor notes never enter notifications, logs, or aggregates (I-MNT-006).

### 4.8 Issues (module `issues`)

| Element | Kind | Notes |
| --- | --- | --- |
| `Issue` | Aggregate root | `id`, `householdId`, `title`, `description?`, `roomId?`, `assetId?`, `severity`, `status`, `reportedById`, `reportedAt`, `assigneeId?`, `vendorNote?`, `acknowledgedAt?`, `resolvedAt?`, `closedAt?` |
| `IssueTransition` | Entity (append-only) | `id`, `issueId`, `from`, `to`, `actorId`, `at`, `note?` |
| `IssueComment` | Entity | `id`, `issueId`, `authorId`, `body`, `createdAt`, `attachmentIds[]` |
| `IssueStatus` | Value object / enum | `OPEN` \| `ACKNOWLEDGED` \| `IN_PROGRESS` \| `RESOLVED` \| `CLOSED` \| `WONT_FIX` |
| `IssueSeverity` | Value object / enum | `LOW` \| `NORMAL` \| `HIGH` \| `SAFETY` |

**Invariants:** only legal transitions are accepted and each appends an audit row (I-ISSUE-001); `SAFETY` issues alert immediately and reach an owner/admin (I-ISSUE-002); resolution is attributed and `WONT_FIX` requires a reason (I-ISSUE-003); comments are append-only (I-ISSUE-004); a photo is never a precondition for reporting or resolving (I-ISSUE-005); closed issues reject new comments (I-ISSUE-006).

### 4.9 Alerts (module `alerts`)

| Element | Kind | Notes |
| --- | --- | --- |
| `Alert` | Aggregate root | `id`, `householdId`, `type`, `priority`, `state`, `dedupeKey`, `title`, `explanation`, `expectedAction`, `expectedBy?`, `entityRef`, `actionTarget`, `recipient`, `recipientReason`, timestamps, `priorityReason`, `escalationCount` |
| `AlertTransition` | Entity (append-only) | `id`, `alertId`, `from`, `to`, `actorId?`, `at`, `reason` |
| `AlertType` | Value object / enum | The ten types in FR-ALERT-002 |
| `AlertPriority` | Value object / enum | `INFO` \| `ATTENTION` \| `IMPORTANT` \| `URGENT` |
| `AlertState` | Value object / enum | `OPEN` \| `ACKNOWLEDGED` \| `SNOOZED` \| `RESOLVED` \| `EXPIRED` |
| `DedupeKey` | Value object | Deterministic per condition (ADR-008) |
| `EntityRef` | Value object | `{ type, id }` — typed reference to the subject |

**Invariants:** at most one non-terminal alert per `(householdId, dedupeKey)` (I-ALERT-001); every alert answers the five questions (I-ALERT-002); auto-resolution when the condition clears (I-ALERT-003); snooze bounded and auto-reopening (I-ALERT-004); escalation never creates a second alert (I-ALERT-005); recipients are explicit and never broadcast (I-ALERT-006); quiet hours and caps suppress delivery, never creation or in-app visibility (I-ALERT-007); acknowledgement never resolves (I-ALERT-008).

### 4.10 Notifications (feature + server · not a domain module)

Owned here: `NotificationPreference` (type × channel matrix, quiet hours, cap), `PushSubscription` (device, endpoint, keys hash, last success/failure), `NotificationIntent` (declarative), `NotificationAttempt` (delivery outcome). No domain invariants; the rules are policy (ADR-009) and are pure functions.

### 4.11 Auth (server module · not a domain module)

Owned here: `User` (account), `Session`, `Credential`, `VerificationToken`, rate-limit buckets. Household membership is *referenced*, never owned (ADR-004).

### 4.12 Activity (module `activity`)

| Element | Kind | Notes |
| --- | --- | --- |
| `ActivityEvent` | Entity (append-only, aggregate root) | `id`, `householdId`, `actorId?`, `type`, `entityRef`, `summary`, `metadata` (bounded, non-PII), `occurredAt`, `retainUntil?` |
| `ActivityType` | Value object / enum | Concise catalogue in docs/product/ACTIVITY.md |

**Invariants:** append-only (I-ACT-001); household-scoped (I-ACT-002); no PII beyond ids and titles already visible in-app (I-ACT-003); pruned past retention by a job (I-ACT-004); titles are snapshots so history survives renames (I-ACT-005); no presence, view, or per-member counting data exists (I-ACT-006).

## 5. Cross-aggregate relationships

| Relationship | Cardinality | Rule |
| --- | --- | --- |
| Household → everything (I-XA-001) | 1:N | Cascade for dependent children only; `RESTRICT` for aggregates (DATA_MODEL.md) |
| Room → chores | 1:N (optional) | Deleting/archiving a room must not orphan open occurrences; they become room-less |
| Membership → assignments (I-MEM-004) | 1:N | Removing a member reassigns or unassigns their open items (documented behaviour, I-MEM-004) |
| Occurrence → completion | 1:0..1 active completion | Multiple completions only via explicit correction (recorded) |
| Resource → shopping item | 1:0..N | Items may exist without a resource; a linked item updates the resource on purchase |
| Asset → plan → record | 1:N:1 | Records may exist without a plan (one-off service) but are attributed to an asset |
| Issue → chore/maintenance | 0..N follow-ups | Follow-ups are new entities referencing the issue; the issue stays the problem record |
| Condition → alert (I-ALERT-001) | 1:0..1 per dedupe key | Derived; disappears when the condition clears |

## 6. Domain boundaries and what crosses them

| Boundary | Allowed crossing | Forbidden |
| --- | --- | --- |
| household ↔ others (I-XA-001, I-XA-002) | Read tenancy + role; write invitations/settings; the context is minted from the session | Reading another module's tables directly |
| chores → rooms | Reference `roomId`; ask rooms to recompute status **via an event** | Importing room internals |
| chores → alerts | Emit `ChoreDue`/`ChoreOverdue`/`ChoreCompleted` facts | Creating alerts inline in chore code |
| trash/resources/maintenance/issues → alerts | Emit condition events | Deciding recipients/priority details (alert module owns that) |
| alerts → notifications | Emit `AlertCreated`/`AlertEscalated`/`AlertResolved` | Choosing channels or sending |
| anything → activity | Append an `ActivityEvent` | Reading activity as a source of truth |
| dashboard → all of the above | Read-only via read models | Writing, or owning rules |

## 7. Domain services (declared, unimplemented)

| Service | Module | Responsibility | Contract file |
| --- | --- | --- | --- |
| `materialiseNextOccurrence` | chores | Create the next occurrence when none is open | `src/domain/chores/services.ts` |
| `calculateNextOccurrence` | chores | Pure recurrence computation | `src/domain/chores/recurrence.ts` |
| `completeOccurrence` | chores | Record completion, resolve alerts, close the loop | `src/domain/chores/services.ts` |
| `skipOccurrence` / `snoozeOccurrence` / `reassignOccurrence` | chores | Bounded, attributed deferral/ownership changes | `src/domain/chores/services.ts` |
| `deriveRoomStatus` | rooms | Apply the ADR-010 rule set | `src/domain/rooms/status.ts` |
| `applyRoomOverride` | rooms | Create/replace an expiring manual override | `src/domain/rooms/status.ts` |
| `transitionTrashState` | trash | Enforce the container state graph + hysteresis | `src/domain/trash/services.ts` |
| `completeTrashCollection` | trash | Record collection, reset state, resolve alerts | `src/domain/trash/services.ts` |
| `evaluateResourceThresholds` | resources | Derive restock needs from levels/mode | `src/domain/resources/thresholds.ts` |
| `recordRestock` | resources | Set level, close need, update shopping | `src/domain/resources/services.ts` |
| `computeNextServiceAt` | maintenance | Frequency math with clamping | `src/domain/maintenance/scheduling.ts` |
| `recordService` | maintenance | Append record, recompute next due | `src/domain/maintenance/services.ts` |
| `transitionIssue` | issues | Enforce lifecycle graph | `src/domain/issues/services.ts` |
| `evaluateAlerts` | alerts | Recompute desired alerts from household state | `src/domain/alerts/engine.ts` |
| `dedupeKeyFor` | alerts | Deterministic condition keys | `src/domain/alerts/dedupe.ts` |
| `transitionAlert` | alerts | Acknowledge/snooze/resolve/expire with rules | `src/domain/alerts/services.ts` |
| `appendActivity` | activity | Append-only write with retention stamp | `src/domain/activity/services.ts` |

All of the above currently `throw new Error("Not implemented: <TASK-ID>")`. That is the point of this phase.

## 8. What the domain deliberately does not contain

Chat/messages · reactions · likes · scores · streaks · leaderboards · presence/location · expense splitting · vendor directories · approvals/work orders · subtasks/dependencies · recurring-calendar interop (iCal) · inventory forecasting · grocery price tracking · document/photo management beyond per-record attachments.

Adding any of these requires: a PRD change, a new ADR, and a DECISIONS.md entry (AGENTS.md §7).
