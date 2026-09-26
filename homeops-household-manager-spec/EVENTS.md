# EVENTS.md — Domain Event Catalogue

> 2026-09-26 · Status: **CATALOGUED, NOT IMPLEMENTED** · No event bus, publisher, or subscriber exists in this phase.
> **Do not build an event bus.** This catalogue exists so that (a) alert evaluation has a defined trigger set, (b) activity records have consistent names, (c) future implementers agree on vocabulary. Events are consumed **in-process** (ARCHITECTURE.md §3, §7 step 5) or not at all.

## 1. Rules

| Rule | Detail |
| --- | --- |
| Names are past tense facts | `ChoreCompleted`, not `CompleteChore`. An event describes something that happened. |
| Events carry ids, not payloads | An event references entities by id + household id; consumers load what they need. This keeps events small and prevents PII in transit/logs. |
| Events are recorded, not guaranteed-delivered | If a consumer is unavailable, nothing is lost: alert state is recomputed from domain state on the next tick (ADR-008). |
| Exactly one publish point per fact | The module that owns the record publishes, inside the same transaction that wrote it. |
| The outbox is the only durable "queue" | When an event must cause external delivery (notifications), the intent is written to `outbox_message` in the same transaction (ADR-009, ADR-013). |
| Activity and events are different things | An activity record is a *user-visible* summary; an event is an internal fact. Many events may map to one activity record, and not every event is activity-worthy. |
| Envelope shape | `{ id, type, householdId, occurredAt (UTC instant), actorId?, entityRef: {type,id}, source: 'REQUEST'\|'SCHEDULER'\|'SYSTEM', correlationId }` |

## 2. Household & membership events

| Event | Emitted when | Emitted by | Consumed by (in-process) | Activity-worthy | Notes |
| --- | --- | --- | --- | --- | --- |
| `HouseholdCreated` | A household row is created | household | activity, notifications (welcome, optional) | yes | Sets timezone, seeds settings defaults |
| `HouseholdSettingsChanged` | Name/timezone/week start/thresholds change | household | activity, scheduler (recompute future occurrences), alerts (threshold changes) | yes | Timezone change never rewrites history (FR-HH-008) |
| `HouseholdArchived` | Household becomes read-only | household | activity, notifications, scheduler (skip household) | yes | All mutations then fail with `HOUSEHOLD_ARCHIVED` |
| `InvitationCreated` | An invitation is issued | household | activity, notifications (email if configured) | yes | Token never appears in the event payload |
| `InvitationRevoked` / `InvitationExpired` | Invitation invalidated | household / scheduler | activity | yes | Expiry sweep by scheduler |
| `MemberJoinedHousehold` | Invitation accepted | members | activity, notifications (welcome), alerts (recipient pools grow) | yes | |
| `MemberRoleChanged` | Role changes, incl. ownership transfer | members | activity, audit log, notifications (affected member) | yes | Audit-required (NFR-SEC-009) |
| `MemberRemoved` | A member is removed | members | activity, audit log, sessions (revoke), push subscriptions (delete), chores/issues (reassign), alerts (reroute) | yes | Single most cross-cutting event; documented in docs/security/AUTHZ-MATRIX.md |
| `MemberLeftHousehold` | Voluntary leave | members | same as removal minus audit severity | yes | |
| `MemberAwayPeriodSet` | Away window set/cleared | members | notifications (recipient selection), alerts (skip away recipients) | no | |

## 3. Room events

| Event | Emitted when | Emitted by | Consumed by | Activity-worthy | Notes |
| --- | --- | --- | --- | --- | --- |
| `RoomCreated` / `RoomUpdated` / `RoomArchived` | Room lifecycle | rooms | activity, dashboard read model | yes | Archiving requires a decision about open occurrences (API §3) |
| `RoomStatusOverrideSet` | A manual override is applied | rooms | activity, dashboard read model | yes | Carries expiry, never the derived status |
| `RoomStatusOverrideExpired` | Override TTL elapsed | scheduler | activity | no | Derived state resumes (ADR-010) |

> There is deliberately **no** `RoomBecameDirty` event: room status is a derived read model, and a derived value must not generate alerts (I-ROOM-004). The underlying `ChoreOverdue` event is what matters.

## 4. Chore events

| Event | Emitted when | Emitted by | Consumed by | Activity-worthy | Notes |
| --- | --- | --- | --- | --- | --- |
| `ChoreDefinitionCreated` | Definition created | chores | activity | yes | |
| `ChoreDefinitionUpdated` | Definition edited | chores | activity, scheduler (recompute next), alerts (explain change) | yes | Open occurrences get a "definition changed" note |
| `ChoreDefinitionPaused` / `ChoreDefinitionResumed` | Pause toggled | chores | scheduler (stop/start materialisation), alerts (do not fire while paused) | yes | Pausing resolves any due-soon alert with reason `PAUSED` |
| `ChoreDefinitionArchived` | Archived | chores | scheduler, alerts | yes | Open occurrence is cancelled or completed per caller's choice |
| `ChoreOccurrenceMaterialised` | Next occurrence created | scheduler | dashboard (cache invalidation) | no | Idempotent via `occurrenceKey` |
| `ChoreDue` | An occurrence's due date has arrived (household time) | scheduler (tick) | alerts, notifications, dashboard | no | One per occurrence; alert dedupe key `CHORE_DUE:occurrence:<id>` |
| `ChoreOverdue` | Due date passed without completion | scheduler (tick) | alerts, dashboard | no | Escalates priority after the configured grace period |
| `ChoreCompleted` | Completion recorded | chores | alerts (auto-resolve due/overdue), activity, dashboard, room status derivation, scheduler (completion-anchored recurrence) | yes | Idempotent; carries `wasLate` flag |
| `ChoreSkipped` | Occurrence skipped with reason | chores | alerts (resolve with reason `SKIPPED`), activity, scheduler | yes | Skip does **not** advance completion-anchored series (I-CHORE-005) |
| `ChoreSnoozed` | Occurrence deferred | chores | alerts (suppress until snooze expires), activity | yes | Bounded; recorded actor |
| `ChoreReassigned` | Assignee changed | chores | alerts (re-target recipient), notifications (new assignee), activity | yes | |
| `ChoreCompletionReopened` | Mistaken completion corrected | chores | alerts (re-open condition evaluation), activity | yes | Time-boxed (24 h) |
| `ChoreOccurrenceCancelled` | Occurrence cancelled by a human | chores | alerts (resolve), activity | yes | Distinct from skip |

## 5. Trash events

| Event | Emitted when | Emitted by | Consumed by | Activity-worthy | Notes |
| --- | --- | --- | --- | --- | --- |
| `TrashContainerCreated` / `Updated` / `Archived` | Container lifecycle | trash | activity, alerts (resolve on archive) | yes | |
| `TrashMarkedAlmostFull` | State → `ALMOST_FULL` | trash | dashboard (hint only) | yes | **No alert**: informational state |
| `TrashMarkedFull` | State → `FULL` | trash | alerts (`TRASH_FULL`), notifications, dashboard | yes | Dedupe key `TRASH_FULL:container:<id>` |
| `TrashCollectionAssigned` | Someone commits to collect | trash | alerts (recipient re-target, priority adjust), notifications, activity | yes | |
| `TrashCollected` | Collection recorded | trash | alerts (auto-resolve `TRASH_FULL`/`TRASH_COLLECTION_DUE`), activity, dashboard | yes | Resets state; idempotent |
| `TrashStateReset` | Manual reset with reason | trash | alerts (resolve with reason), activity | yes | Reason required from `FULL` |
| `TrashCollectionDueSoon` | Schedule window approaching | scheduler | alerts (`TRASH_COLLECTION_DUE`), notifications | no | Only when a schedule exists (FR-TRASH-007) |

## 6. Resource & shopping events

| Event | Emitted when | Emitted by | Consumed by | Activity-worthy | Notes |
| --- | --- | --- | --- | --- | --- |
| `ResourceCreated` / `Updated` / `Archived` | Resource lifecycle | resources | activity, alerts (resolve on archive) | yes | |
| `ResourceModeChanged` | Quantity mode switched | resources | activity, alerts (re-evaluate level semantics) | yes | Level resets (I-RES-002) |
| `ResourceLevelChanged` | Any level update | resources | alerts (threshold evaluation), dashboard, shopping derivation | no (aggregated) | High-volume: activity only for crossings, see below |
| `ResourceMarkedLow` | Level crosses the low threshold | resources | alerts (`RESOURCE_LOW`, grouped), dashboard, shopping | yes | Crossing-triggered, not level-triggered (avoids spam) |
| `ResourceMarkedCritical` | Level crosses the critical threshold | resources | alerts (`RESOURCE_CRITICAL`), notifications, dashboard | yes | Never collapsed without its own visible entry (ADR-008) |
| `ResourceRestocked` | Restock recorded | resources | alerts (auto-resolve), activity, shopping | yes | |
| `ShoppingItemAdded` / `ShoppingItemBought` / `ShoppingItemRemoved` | Shopping list changes | resources | activity (bought only), dashboard counts | partially | `ShoppingItemBought` updates the linked resource level |

## 7. Maintenance events

| Event | Emitted when | Emitted by | Consumed by | Activity-worthy | Notes |
| --- | --- | --- | --- | --- | --- |
| `AssetCreated` / `AssetUpdated` / `AssetArchived` | Asset lifecycle | maintenance | activity | yes | |
| `MaintenancePlanCreated` / `MaintenancePlanUpdated` | Plan changes | maintenance | activity, scheduler (recompute next), alerts | yes | |
| `MaintenancePlanPaused` / `Resumed` | Pause toggled | maintenance | scheduler, alerts (resolve due alerts with reason `PAUSED`) | yes | Seasonal AC use case |
| `MaintenanceDue` | `nextServiceAt - leadTime` reached | scheduler | alerts (`MAINTENANCE_DUE`), notifications | no | Lead time configurable (FR-MNT-007) |
| `MaintenanceOverdue` | `nextServiceAt` passed | scheduler | alerts (`MAINTENANCE_OVERDUE`, escalated priority) | no | |
| `MaintenanceCompleted` | Service recorded | maintenance | alerts (auto-resolve), activity, scheduler (recompute `nextServiceAt`) | yes | Vendor performed ⇒ `actorId` null + `vendorNote` |
| `MaintenanceIssueLinked` | Plan/record linked to an issue | maintenance | activity | yes | Optional provenance (FR-MNT-011) |

## 8. Issue events

| Event | Emitted when | Emitted by | Consumed by | Activity-worthy | Notes |
| --- | --- | --- | --- | --- | --- |
| `IssueReported` | Issue created | issues | alerts (`ISSUE_REQUIRES_ATTENTION` for `HIGH`/`SAFETY` immediately; delay-based otherwise), activity, dashboard | yes | Report path must stay ≤20 s (FR-ISSUE-002) |
| `IssueAcknowledged` | First acknowledgement | issues | alerts (stop escalation; keep open until resolved) | yes | |
| `IssueProgressStarted` | Work begun | issues | activity, dashboard | yes | |
| `IssueAssigned` | Assignee set/changed | issues | alerts (re-target recipient), notifications | yes | |
| `IssueCommented` | Comment added | issues | notifications (assignee/reporter only, if enabled), activity | partially (recent only) | Comment body **never** in the event payload |
| `IssueResolved` | Resolution recorded | issues | alerts (auto-resolve), activity, dashboard | yes | Optional follow-up task creation |
| `IssueClosed` | Verified closed | issues | activity | yes | |
| `IssueMarkedWontFix` | Terminal alternative with reason | issues | alerts (resolve with reason), activity | yes | |
| `IssueAttachmentAdded` | Photo attached | issues | activity (count only) | no | Never includes filenames or storage keys |

## 9. Alert events

| Event | Emitted when | Emitted by | Consumed by | Activity-worthy | Notes |
| --- | --- | --- | --- | --- | --- |
| `AlertCreated` | A new condition alert is written | alerts | notifications (policy → intents/outbox), dashboard | yes (for `IMPORTANT`/`URGENT`) | Dedupe guarantee: one open alert per key |
| `AlertRefreshed` | Condition persists with new facts (priority, expectedBy) | alerts | notifications (only if priority escalated) | no | Prevents duplicate messaging |
| `AlertAcknowledged` | A member takes ownership | alerts | notifications (stop escalation), dashboard, activity | yes | |
| `AlertSnoozed` | Bounded deferral | alerts | scheduler (re-open at `snoozedUntil`), dashboard, activity | yes | |
| `AlertEscalated` | Unacknowledged past the escalation delay | alerts | notifications (wider/urgent recipients) | yes | Never creates a second alert (I-ALERT-005) |
| `AlertAutoResolved` | Condition cleared | alerts | notifications (optional quiet confirmation), dashboard | no | Resolution reason names the clearing fact |
| `AlertResolvedManually` | Human resolved with reason | alerts | activity | yes | Warns if the condition is still detected |
| `AlertExpired` | Alert aged out without action (e.g. `INFO`) | scheduler | dashboard | no | Prevents immortal alerts |
| `AlertRecipientReassigned` | Recipient changed | alerts | notifications, activity | yes | |

## 10. Notification events

| Event | Emitted when | Emitted by | Consumed by | Activity-worthy | Notes |
| --- | --- | --- | --- | --- | --- |
| `NotificationIntentCreated` | Policy decided a member should be told | notifications | outbox drain | no | Idempotent key: (alert, member, channel, window) |
| `NotificationSuppressed` | Policy or quiet hours suppressed delivery | notifications | metrics only | no | Reason recorded (`QUIET_HOURS`, `CAP_REACHED`, `CHANNEL_DISABLED`, `AWAY`, `DUPLICATE`) |
| `NotificationDelivered` | A channel accepted the message | notifications | metrics, delivery history | no | |
| `NotificationFailed` | Delivery failed (transient) | notifications | retry with backoff, metrics | no | |
| `NotificationDeadLettered` | Retries exhausted | notifications | operator signal (OPERATIONS.md) | no | |
| `PushSubscriptionRemoved` | Endpoint gone (410/404) or pruned | notifications | metrics | no | Silent by design (FR-NOTIF-007) |

## 11. Activity & system events

| Event | Emitted when | Emitted by | Consumed by | Notes |
| --- | --- | --- | --- | --- |
| `ActivityRecorded` | An activity row is appended | activity | dashboard recent list | The activity log is a projection of other events, not an independent source |
| `RetentionPruned` | A prune job deleted aged rows | scheduler | metrics | Records counts per table only (PRIVACY.md) |
| `SchedulerTickStarted` / `SchedulerTickCompleted` / `SchedulerTickSkipped` | Tick lifecycle | scheduler | metrics, health endpoint | `Skipped` means the advisory lock was held (single-flight) |
| `SchedulerJobFailed` | A job threw | scheduler | operator signal, metrics | Three consecutive failures raise an operator alert (ADR-013) |
| `DataExported` | Household export produced | household | audit log | Tracks exports for privacy accountability |
| `HouseholdDeletionRequested` | Owner requests deletion | household | operator queue (manual, documented) | No self-service destructive path in v1 |
| `AuthSignInFailed` / `AuthSignInSucceeded` / `AuthSessionRevoked` / `RoleChangeRejected` | Security-relevant auth facts | server/auth | audit log, metrics | Audit-required (NFR-SEC-009); never include credentials or tokens |

## 12. Event → consumer summary

```text
ChoreDue / ChoreOverdue ────────┐
TrashMarkedFull ────────────────┤
TrashCollectionDueSoon ─────────┤
ResourceMarkedLow / Critical ───┼──▶ alerts.evaluateAlerts() ──▶ AlertCreated
MaintenanceDue / Overdue ───────┤                                     │
IssueReported ──────────────────┘                                     ▼
                                                          notifications.policy() ──▶ intents
                                                                                  │
                                                                                  ▼
                                                                       outbox ──▶ delivery ──▶ attempts

any fact ──▶ activity.append()        (user-visible history)
any fact ──▶ dashboard read models    (cache tag invalidation)
ChoreCompleted ──▶ scheduler          (completion-anchored recurrence)
MemberRemoved ──▶ sessions + subscriptions + assignments (cascade)
```

## 13. Explicitly absent events (so nobody invents them)

`RoomBecameDirty` (derived state must not alert) · `MemberOpenedApp` (no presence tracking, NFR-PRIV-007) · `ChoreReminderSent` (delivery is not a domain fact) · `ScoreUpdated` (no scoring exists) · `PresenceChanged` (forbidden) · `BillSplitCreated` (out of scope) · `HttpRequestReceived` (observability concern, not domain).
