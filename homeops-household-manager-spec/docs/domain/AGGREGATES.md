# Aggregate Catalogue

> Companion to DOMAIN.md. One row-block per aggregate: root, members, value objects, identity, invariants, concurrency, port, events.
> Housekeeping: never edit an invariant's meaning here without also updating DOMAIN.md (source of truth) and the ADR that motivated it.

## How to read this

Every aggregate is a **consistency boundary**. Rules that must hold instantly live inside one aggregate; rules that merely need to become true soon are handled by domain events plus a job (EVENTS.md). If a rule needs two aggregates to change together in one transaction, the design is probably wrong — see the boundary table in DOMAIN.md §7.

Value object shorthand: `VO(A|B)` means a discriminated union; `money`-style VOs are deliberately absent (HomeOps tracks supplies and dates, not finances — PRD NG-2).

---

## Household

- **Root:** `Household` (`household.id`)
- **Members:** none — `Membership` is its own aggregate in the `members` module (DOMAIN.md §4.2), referencing the household by id
- **VOs:** `HouseholdName` (1–40 chars), `Timezone` (IANA id), `QuietHours` (start/end local time, may be empty), `AlertPolicy` (escalation delay, snooze max, INFO expiry, daily cap), `ResourceDefaults` (per-mode thresholds), `DayBoundary` (derived from timezone, never stored)
- **Identity:** `uuidv7`
- **Invariants:** I-HH-001 exact one OWNER · I-HH-002 at least one active ADMIN or OWNER · I-HH-003 timezone is a valid IANA id · I-HH-004 all-day windows computed in household timezone
- **Concurrency:** role changes are serialised by a row lock on the household root; all state changes append to `audit_log`
- **Port:** `HouseholdRepository` (`src/domain/household/ports.ts`)
- **Emits:** `household.created`, `household.settings.changed`, `household.member.added/updated/removed`, `household.ownership.transferred`
- **Boundary:** the household is the isolation unit. `HouseholdContext` is minted only in `src/server/auth/context.ts`; no domain function accepts a household id from a client payload.

## Members

- **Root:** `Membership` (`membership.id`)
- **VOs:** `Role` (`OWNER | ADMIN | MEMBER | HELPER`), `AwayPeriod` (`from`/`to`), `RecipientReason` (`ASSIGNED | ROLE | FALLBACK_OWNER`)
- **Identity:** `uuidv7`
- **Invariants:** I-MEM-001 ≥1 owner · I-MEM-002 role changes require OWNER/ADMIN · I-MEM-003 removal invalidates sessions and subscriptions in the same transaction · I-MEM-004 removal reassigns or unassigns open items · I-MEM-005 historical activity survives with a snapshotted name
- **Concurrency:** role and removal operations take a lock on the household's membership set; the last-owner rule is also defended by a database constraint
- **Port:** `MembershipRepository`
- **Emits:** `member.invited/joined/role.changed/removed/away.set`
- **Boundary:** membership never owns account data (users, credentials, sessions live in `server/auth`, ADR-004).

## Room

- **Root:** `Room` (`room.id`)
- **Members:** none (chores reference a room by id — a reference, not composition)
- **VOs:** `RoomName` (1–40 chars), `RoomGroup` (optional label), `RoomStatus` (`CLEAN | NEEDS_ATTENTION | DIRTY | CLEANING | UNKNOWN` — **no numeric score by decision**, ADR-010), `StatusOverride` (`{ status, reason, expiresAt, setBy }`, at most one active per room), `NotInUse` (boolean flag)
- **Identity:** `uuidv7`
- **Invariants:** I-ROOM-001 one active override per room · I-ROOM-002 override expiry ≤ household maximum · I-ROOM-003 derived status is a pure function of (open room-scoped occurrences, completions, overrides, clock) · I-ROOM-004 not-in-use rooms are excluded from derivation · I-ROOM-005 archival requires handling of open occurrences
- **Concurrency:** override writes take a row lock; derivation is computed read-only from snapshot inputs
- **Port:** `RoomRepository`
- **Emits:** `room.created/updated/archived`, `room.status.overridden`, `room.override.expired`
- **Never emits:** an alert for a status change (a status *is* information; alerts come from the underlying facts — ADR-010)

## Chore (definition + occurrence)

- **Roots:** `ChoreDefinition` and `ChoreOccurrence` — two aggregates linked by reference, **not** one big aggregate. Definitions are edited rarely and read constantly; occurrences are the high-write, high-contention side.
- **VOs:** `ChoreTitle` (1–80), `Priority` (`LOW | NORMAL | HIGH`), `RecurrenceRule` (`NONE | DAILY | WEEKDAYS | EVERY_N_DAYS | EVERY_N_WEEKS | MONTHLY | EVERY_N_MONTHS | AFTER_COMPLETION`), `OccurrenceStatus` (`SCHEDULED | IN_PROGRESS | DONE | SKIPPED | SNOOZED | CANCELLED`), `CompletionRecord` (`{ completedAt, completedBy, note?, attachmentId? }`), `SkipReason` (enum + note), `SnoozeWindow`
- **Invariants:** I-CHORE-001 at most one open occurrence per definition (DB partial unique index) · I-CHORE-002 occurrence key is deterministic for its slot · I-CHORE-003 skip never advances an `AFTER_COMPLETION` series · I-CHORE-004 the next occurrence is computed from `anchor`/`lastCompletedAt` in the household timezone, never from the tick time · I-CHORE-005 definition edits never rewrite history (the definition is snapshotted onto the occurrence for display) · I-CHORE-006 a definition cannot be archived with an open occurrence until that occurrence is resolved
- **Concurrency:** materialisation is guarded by the partial unique index and an advisory lock per household (ADR-013); completion is idempotent through `clientRequestId`
- **Ports:** `ChoreDefinitionRepository`, `ChoreOccurrenceRepository`
- **Emits:** `chore.definition.*`, `chore.occurrence.materialised/completed/skipped/snoozed/reassigned/overdue`
- **Consumers:** alerts (due/overdue), room status (via events), activity

## Trash

- **Root:** `TrashContainer` (`trash_container.id`)
- **VOs:** `ContainerKind` (`ORGANIC | RECYCLABLE | GENERAL | HAZARDOUS | BULKY`), `ContainerState` (`EMPTY | AVAILABLE | ALMOST_FULL | FULL | COLLECTION_REQUIRED`), `CollectionSchedule` (weekday set + window start/end, household-local), `TransitionReason` (enum)
- **Invariants:** I-TRASH-001 state transitions follow the documented graph; illegal moves are rejected with `TRASH_INVALID_TRANSITION` · I-TRASH-002 one open alert per container (via dedupe key) · I-TRASH-003 hysteresis: `ALMOST_FULL → FULL` requires an explicit actor action, never an automatic downgrade/upgrade · I-TRASH-004 every transition writes a state event · I-TRASH-005 reset from `FULL` requires a reason
- **Concurrency:** row lock on transition
- **Port:** `TrashRepository`
- **Emits:** `trash.state.changed`, `trash.collection.assigned/completed`, `trash.schedule.due`
- **Boundary:** trash never creates notifications directly; it emits facts and the alert engine decides whether a problem exists (ADR-008).

## Resource + ShoppingItem

- **Roots:** `Resource` and `ShoppingItem` (a shopping item may reference a resource, or stand alone)
- **VOs:** `QuantityMode` (`EXACT | APPROXIMATE | AVAILABLE_UNAVAILABLE`), `Level` (mode-exhaustive union: `Exact{quantity,unit} | Approximate{FULL|ENOUGH|LOW|CRITICAL|EMPTY} | Binary{AVAILABLE|UNAVAILABLE}`), `Threshold` (`{ lowAt, criticalAt }` constrained per mode), `RestockTarget`
- **Invariants:** I-RES-001 level shape always matches the mode (no EXACT level without a unit) · I-RES-002 threshold ordering (`criticalAt < lowAt`, or mode-appropriate equivalents) · I-RES-003 a mode change **resets** the level and is recorded unless the mode is unchanged (idempotent no-op) · I-RES-004 low/critical transitions emit **crossing** events only, not per-update events · I-RES-005 one grouped resource alert per household per window · I-RES-006 binary `UNAVAILABLE` is always CRITICAL
- **Concurrency:** level updates are last-write-wins with an optimistic version; crossing detection happens inside the same transaction as the write
- **Ports:** `ResourceRepository`, `ShoppingRepository`
- **Emits:** `resource.level.changed`, `resource.threshold.crossed` (low/critical, direction), `resource.restocked`, `resource.mode.changed`, `shopping.item.added/removed/purchased`

## Maintenance (asset + plan + record)

- **Roots:** `Asset`, `MaintenancePlan`, `MaintenanceRecord` — three aggregates; the plan references an asset (or neither, for household-level plans).
- **VOs:** `ServiceFrequency` (`EVERY_N_DAYS | EVERY_N_WEEKS | EVERY_N_MONTHS | EVERY_N_YEARS | MONTHS_OF_YEAR(set)`), `LeadTime` (0–90 days), `ServiceRecordedBy` (`MEMBER{actorId} | EXTERNAL{vendorNote}`), `CostNote` (free text or numeric — no totals, ever)
- **Invariants:** I-MNT-001 `nextServiceAt` is **derived** and always recomputable from records + frequency (never hand-edited, never advanced by an alert) · I-MNT-002 date-based scheduling ignores DST · I-MNT-003 a service record belongs to exactly one of (plan, asset) · I-MNT-004 paused plans are excluded from due evaluation and their open alerts resolve with reason `PAUSED` · I-MNT-005 monthly clamping is preserved (31st → last day, never drift to the 28th for later months)
- **Concurrency:** record insertion recomputes `nextServiceAt` in the same transaction
- **Ports:** `MaintenanceRepository`
- **Emits:** `maintenance.plan.created/updated/paused/resumed`, `maintenance.record.added`, `maintenance.due`, `maintenance.overdue`
- **Boundary:** household-oriented, not a CMMS (ADR-012): no work orders, no parts inventory, no MTBF dashboards, no cost reporting.

## Issue

- **Root:** `Issue` (`issue.id`) with append-only `IssueComment` children (a comment has no meaning without its issue)
- **VOs:** `IssueSeverity` (`LOW | NORMAL | HIGH | SAFETY`), `IssueStatus` (`OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED`, plus `WONT_FIX`), `IssueCategory`, `AttachmentRef`
- **Invariants:** I-ISSUE-001 legal transitions only (`ISSUE_INVALID_TRANSITION`) · I-ISSUE-002 `SAFETY` severity always reaches at least one owner/admin and bypasses quiet hours · I-ISSUE-003 acknowledgement stops escalation but keeps the alert open · I-ISSUE-004 `WONT_FIX` and `RESOLVED` require an actor; closing requires reporter/OWNER/ADMIN · I-ISSUE-005 photos are optional, never a precondition (the "under 20 seconds" rule) · I-ISSUE-006 closed issues accept no new comments
- **Concurrency:** status transition under a row lock; comments append-only
- **Port:** `IssueRepository`
- **Emits:** `issue.reported/acknowledged/progressed/resolved/closed/wont_fix/commented/severity.changed`
- **Boundary:** issues are the problem record; fixing work becomes a chore, a maintenance record, or nothing at all (ADR-005).

## Alert

- **Root:** `Alert` (`alert.id`)
- **VOs:** `AlertType` (10 types, ALERTS product doc), `AlertPriority` (`INFO | ATTENTION | IMPORTANT | URGENT`), `AlertState` (`OPEN | ACKNOWLEDGED | RESOLVED | EXPIRED`), `DedupeKey` (string, type-templated), `Recipient` (`{ memberId, reason }`), `RecipientReason` (`ASSIGNED | ROLE | OWNER_FALLBACK | MANUAL`), `ResolutionReason` (enum), `SnoozeUntil`
- **Invariants:** I-ALERT-001 at most one non-terminal alert per dedupe key (partial unique index) · I-ALERT-002 acknowledgement and resolution are distinct states · I-ALERT-003 snooze is bounded (≤ household max, default 24 h) · I-ALERT-004 only IMPORTANT/URGENT escalate, once per cooldown · I-ALERT-005 quiet hours and caps suppress **delivery**, never creation · I-ALERT-006 every transition appends to `alert_transition` · I-ALERT-007 an alert is never broadcast to all members (recipient resolution is deterministic — ADR-009)
- **Concurrency:** transitions serialised by row lock; the engine reconciles desired state idempotently (running twice changes nothing)
- **Port:** `AlertRepository`
- **Emits:** `alert.opened/refreshed/escalated/acknowledged/snoozed/resolved/expired`
- **Boundary:** the engine is a **pure function** over provided household state; it performs no I/O and knows nothing about channels.

## Notification (feature + server — deliberately **not** a domain module)

- **Roots:** `NotificationPreference` (per member), `PushSubscription` (per device), `OutboxMessage` + `NotificationAttempt` (delivery machinery — the only queue-shaped tables in the schema, ADR-009). These live in `features/notifications` (preferences + pure policy) and `server/notifications` (subscriptions, outbox, adapters) because they carry no domain rules (FR-NOTIF-001, ARCHITECTURE.md §9).
- **VOs:** `Channel` (`IN_APP | PUSH | EMAIL`), `WindowKey` (dedupe window for intents), `SuppressionReason` (`QUIET_HOURS | CAP_REACHED | AWAY | CHANNEL_DISABLED | DUPLICATE`), `DeliveryOutcome` (`delivered | transient_failure | permanent_failure`)
- **Invariants:** I-NOTIF-001 intents are unique on `(alertId, memberId, channel, windowKey)` · I-NOTIF-002 the outbox stores ids and types only — never user content · I-NOTIF-003 policy is pure and testable; delivery I/O is isolated behind a port · I-NOTIF-004 payloads contain no notes, comments, photos, or member names · I-NOTIF-005 in-app alerts are never suppressed (the dashboard is the truth)
- **Concurrency:** drain job with `pg_try_advisory_lock`, batched, idempotent across restarts
- **Ports:** `PushProvider`, `EmailProvider`, `NotificationRepository` (implemented by `server/notifications`)
- **Emits:** `notification.intent.created/suppressed/delivered/failed`

## Activity + Audit

- **Roots:** `ActivityEvent` (household-visible history) and `AuditLog` (security/role changes) — intentionally separate: one is a product surface, the other an operator artifact.
- **VOs:** `ActivityType` (closed catalogue), `SummarySnapshot` (title strings captured at write time), `ActorRef`
- **Invariants:** I-ACT-001 append-only; no updates or deletes outside the prune job · I-ACT-002 metadata is bounded and PII-free (ids, enums, counts — never free text) · I-ACT-003 no view/read/presence events exist · I-ACT-004 per-member productivity counts are not derivable from any read model · I-ACT-005 retention is enforced by a job, not by convention
- **Concurrency:** append-only inserts; prune in batches
- **Ports:** `ActivityRepository`, `AuditRepository`
- **Emits:** nothing (terminal consumers)

---

## Aggregates deliberately not created

| Candidate | Why not |
| --- | --- |
| `Dashboard` | It is a read model, not a consistency boundary (ARCHITECTURE.md, T-DASH-001). |
| `Notification` as a domain entity | Notification is a delivery concern derived from alerts; the domain owns only preferences and intents (DECISIONS.md). |
| `HouseholdInventory` spanning resources and trash | They answer different questions on different cadences; merging them creates a god aggregate. |
| `Score` / `CleanlinessRating` | Rejected by ADR-010 and DESIGN.md §18: no numeric scoring of a home or its members. |
