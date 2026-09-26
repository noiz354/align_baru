# GLOSSARY.md — HomeOps Vocabulary

> One meaning per term. If a term is used differently in code, in docs, or in the UI, that is a bug — fix the term.

## Domain terms

| Term | Definition | Where defined |
| --- | --- | --- |
| **Household** | The tenancy root: a home shared by a set of members. Owns every scoped record and the timezone used for scheduling. | DOMAIN.md §4.1, ADR-005 |
| **Member** | A user's participation in a household, with a role. The user account exists independently of membership. | DOMAIN.md §4.2, ADR-004 |
| **Role** | `OWNER` \| `ADMIN` \| `MEMBER` \| `HELPER` — coarse permissions within one household. | docs/security/AUTHZ-MATRIX.md |
| **Room** | A place in the home with an identity and a derived high-level state. Not a label. | docs/product/ROOMS.md, ADR-010 |
| **Room status** | One of `CLEAN` \| `NEEDS_ATTENTION` \| `DIRTY` \| `CLEANING` \| `UNKNOWN`, always with a stated reason. | ADR-010 |
| **Chore** | Informal: the work itself. Formal: the *definition* of a recurring or one-off household task. | docs/product/CHORES.md, ADR-006 |
| **Chore definition** | The reusable routine: title, room?, priority, assignee?, recurrence?, pause/archive flags. | ADR-006 |
| **Chore occurrence** | One planned instance of a definition with a due date; the thing a member completes or skips. | ADR-006 |
| **Chore completion** | The recorded act of doing the work (actor, time, optional note/photo); the audit truth. | ADR-006 |
| **Skip** | A recorded decision not to do an occurrence, with a reason. Not a deletion, and it does not advance completion-anchored recurrence. | FR-CHORE-007, ADR-007 |
| **Snooze** | A bounded deferral of an occurrence or alert, attributed to an actor. | FR-CHORE-009, FR-ALERT-008 |
| **Recurrence rule** | One of seven closed variants (`DAILY`, `WEEKDAYS`, `EVERY_N_DAYS`, `EVERY_N_WEEKS`, `MONTHLY`, `EVERY_N_MONTHS`, `AFTER_COMPLETION`). | docs/product/RECURRENCE.md, ADR-007 |
| **Calendar-anchored** | Recurrence computed from the schedule/anchor date, unaffected by when work was actually done. | ADR-007 |
| **Completion-anchored** | Recurrence computed from `lastCompletedAt` (`AFTER_COMPLETION`). | ADR-007 |
| **Materialisation** | Creating the next occurrence for a definition when none is open. Idempotent via `occurrenceKey`. | ADR-006, ADR-013 |
| **Trash container** | A specific bin/receptacle with its own state and collection history. | docs/product/TRASH.md |
| **Collection** | The act of emptying a container for pickup; recorded as an event and resets container state. | FR-TRASH-005 |
| **Container state** | `EMPTY` \| `AVAILABLE` \| `ALMOST_FULL` \| `FULL` \| `COLLECTION_REQUIRED`. | FR-TRASH-002 |
| **Resource** | A tracked consumable with a quantity mode and thresholds. | docs/product/RESOURCES.md, ADR-011 |
| **Quantity mode** | `EXACT` \| `APPROXIMATE` \| `AVAILABLE_UNAVAILABLE`. | ADR-011 |
| **Approximate level** | `FULL` \| `ENOUGH` \| `LOW` \| `CRITICAL` \| `EMPTY`. | ADR-011 |
| **Restock need** | The derived condition "this resource needs buying", surfaced on shopping surfaces. | FR-RES-007 |
| **Shopping item** | An entry needing purchase: derived from a restock need, or added manually. | docs/product/RESOURCES.md |
| **Asset** | A thing that needs care (AC unit, water filter, washing machine). | docs/product/MAINTENANCE.md, ADR-012 |
| **Maintenance plan** | A recurring expectation attached to an asset (or the household) with a frequency and lead time. | ADR-012 |
| **Maintenance record** | A completed service: actor or `EXTERNAL` vendor, date, cost note, notes. | ADR-012 |
| **Issue** | A reported problem needing attention, with a lifecycle and severity. | docs/product/ISSUES.md |
| **Severity** | `LOW` \| `NORMAL` \| `HIGH` \| `SAFETY` for issues. Distinct from alert priority. | FR-ISSUE-006 |
| **Alert** | A durable, deduplicated, condition-derived item stating what happened, why it matters, who should act, the available action, and when action is expected. | docs/product/ALERTS.md, ADR-008 |
| **Alert type** | e.g. `CHORE_DUE`, `TRASH_FULL`, `RESOURCE_CRITICAL`, `MAINTENANCE_OVERDUE`, `ISSUE_REQUIRES_ATTENTION`. | FR-ALERT-002 |
| **Priority** | `INFO` \| `ATTENTION` \| `IMPORTANT` \| `URGENT` — consequence-based, with a recorded reason. | FR-ALERT-003 |
| **Dedupe key** | Deterministic string ensuring one open alert per real-world condition. | ADR-008 |
| **Acknowledge** | "I have seen and own this." Stops escalation; does not resolve. | FR-ALERT-007 |
| **Resolve** | The condition is gone. Usually automatic. | FR-ALERT-009 |
| **Escalation** | Raising priority/recipient scope for an unacknowledged `IMPORTANT`/`URGENT` alert after a delay. Never creates a second alert. | FR-ALERT-011 |
| **Quiet hours** | A window in which non-`URGENT` *delivery* is suppressed; alert state is unaffected. | FR-ALERT-012 |
| **Notification** | An interruption on a channel, produced by policy from an alert. Not the alert itself. | ADR-009 |
| **Notification intent** | The declarative output of policy: (alert, member, channel, window) — idempotent. | ADR-009 |
| **Delivery attempt** | The recorded outcome of trying to deliver one intent on one channel. | FR-NOTIF-006 |
| **Activity** | An append-only record of a significant change: what, who, when, in which household. | docs/product/ACTIVITY.md |
| **Read model** | A query-shaped projection owned by a feature (e.g. `DashboardSnapshot`) with no business rules. | ARCHITECTURE.md §8 |
| **Snapshot** | The dashboard's declared contract: one composition of read models, no per-card waterfalls. | docs/product/DASHBOARD.md |

## Technical terms

| Term | Definition |
| --- | --- |
| **HouseholdContext** | `{ householdId, actorId, role, timezone, clock }` produced only from the session (or explicitly constructed by a job). The first argument of every scoped port call. |
| **Port** | An interface declared in `src/domain/**/ports.ts` describing what a module needs from the outside world (persistence, clock, notifier). |
| **Adapter** | An implementation of a port, living in `src/server/**`. The only place infrastructure libraries may be imported. |
| **Feature module** | A use-case + read-model + presentation unit under `src/features/**`. |
| **Domain event** | A recorded fact that something happened (`ChoreCompleted`), consumed in-process. Conceptually catalogued in EVENTS.md; no bus in v1. |
| **Outbox** | A table where a notification intent is written in the same transaction as the domain change, then drained by a job. |
| **Single-flight** | A scheduling guarantee that only one instance runs a job at a time, enforced with a Postgres advisory lock. |
| **Idempotent** | Running the operation twice has the same effect as running it once. Required of all mutations and jobs. |
| **Staleness banner** | The UI affordance stating cached data may be out of date (DESIGN §11 E-6, ADR-014). |
| **Expanding migration** | A schema change that adds structures without breaking the currently deployed code (CONTRIBUTING.md#migrations). |

## Naming and identifier conventions

| Pattern | Meaning | Examples |
| --- | --- | --- |
| `FR-<AREA>-NNN` | Functional requirement | `FR-CHORE-014`, `FR-ALERT-005` |
| `NFR-<AREA>-NNN` | Non-functional requirement | `NFR-PERF-001`, `NFR-PRIV-003` |
| `T-<AREA>-NNN` | Task ID; short area codes (T-RES-014 ≡ T-RES-014 legacy alias) | `T-CHORE-021`, `T-PLAT-004` |
| `ADR-NNN` | Architecture decision record | `ADR-007` |
| `VS-NN` | Vertical slice in ROADMAP.md | `VS-5` |
| `I-<MODULE>-NNN` | Domain invariant | `I-CHORE-004` |
| `H-N` / `DP-N` / `CP-N` / `LY-N` / `T-N` | Hierarchy rank / design principle / component principle / layout rule / tone rule in DESIGN.md | `DP-4`, `CP-3` |
| `TERM` in code | `SCREAMING_SNAKE_CASE` enum members | `TrashContainerState.FULL` |

## Deliberately absent concepts

`Work order`, `SLA`, `Department`, `Shift`, `Approval`, `Bill of materials`, `Score`, `Streak`, `Points`, `Presence`, `Geofence`, `Stock forecast`. If a task requires one of these, the task is out of scope for v1 and needs a product decision (PRD §4.2).
