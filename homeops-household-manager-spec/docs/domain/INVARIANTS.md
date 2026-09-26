# Invariant Catalogue

> **Provenance rule:** `DOMAIN.md` §4 is the authoritative register of per-module invariant IDs; this file adds the *enforcement point*, the *failure consequence*, and the *test* for each of them, and introduces IDs only where a rule needs a stable identifier for test naming.
> Where a row is marked **(extension)**, the rule is real and testable but is not yet carried in DOMAIN.md §4 — the ID is reserved here and must be folded into DOMAIN.md when the owning module is implemented (T-DOC-001 keeps this honest).
> Every rule must be true at the end of every transaction that touches its aggregate.

## Enforcement legend

| Tag | Meaning |
| --- | --- |
| `DB` | Database constraint/index — the strongest guarantee, preferred |
| `AGG` | Aggregate method validates before mutating |
| `PORT` | Repository scopes and rejects (e.g. missing household) |
| `JOB` | Scheduled job restores the invariant (eventually consistent, with a stated bound) |
| `PURE` | A pure function any caller must use; no bypass exists because no other path computes the value |

Each invariant names at least one test (TESTING.md §4 fixes the naming: `T-XXX-NNN <requirement>: behaviour`).

## Cross-aggregate (extension IDs — DOMAIN.md §5 covers the prose)

| ID | Invariant | Enforced by | Violation consequence | Test |
| --- | --- | --- | --- | --- |
| I-XA-001 | Every household-scoped row carries `household_id`, and every read is scoped by it | `DB` (column + index) + `PORT` | Cross-household exposure (S1) | T-SEC-002 |
| I-XA-001a | Every repository port method is household-scoped **by construction**, in one of two shapes: (1) `householdId` is the first parameter; (2) the argument carries a required `householdId` field (aggregate roots and inline append payloads). The only two unscoped calls in the codebase are the pre-context operations `findMembershipHousehold(memberId)` - session bootstrap, resolves which household a member belongs to - and `consumeByTokenHash(tokenHash, now)` - invitation acceptance, where the invitee may have no household yet. Both have their own rows in the T-SEC-002 sweep. No optional `householdId` exists anywhere: an optional scope is an unscoped query waiting to happen. | `PORT` (signatures) + `DB` (predicate) | Cross-household exposure (S1); a signature that permits an unscoped call | T-SEC-002 |
| I-XA-002 | The active household comes only from `HouseholdContext`, minted from the session in `src/server/auth/context.ts` | `AGG` (unreachable constructor) + import lint | Forged household id | T-SEC-001 |
| I-XA-003 | The last OWNER cannot be removed, demoted, or leave | `AGG` + `DB` | Unadministrable household | T-MEM-004 |
| I-XA-004 | Removing a member deletes their sessions (and channel subscriptions) in the same transaction | `AGG` | Access after removal (S1) | T-MEM-005 |
| I-XA-005 | Time is read only through the injected `Clock`; no `new Date()` in domain or feature code | `AGG` (DI) + lint | Non-deterministic recurrence and tests | T-TIME-001 |
| I-XA-006 | All-day boundaries use the household timezone | `PURE` (`src/shared/time`) | A chore due "today" flips at the wrong hour | T-TIME-004 |
| I-XA-007 | Domain events are emitted only after the state change is durable, in the same transaction | `AGG` | Ghost alerts, lost activity | EVENTS.md §2 |

## Household (`domain/household`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-HH-001 **(extension)** | A household's timezone is a valid IANA identifier | `AGG` | Validated on write; invalid values return `TIMEZONE_INVALID` |
| I-HH-002 **(extension)** | An archived household is read-only for every operation except export and deletion | `AGG` | Prevents half-live households (FR-HH-010) |
| I-HH-003 **(extension)** | Quiet hours may be empty, but a window with `start == end` is invalid unless quiet hours are disabled | `AGG` | Avoids a window that means "all day" or "never" |
| I-HH-004 | A timezone change affects only **future** materialised dates; existing occurrences keep the dates they were created with | `AGG` | DOMAIN.md §4.1 (FR-HH-008) |

## Members (`domain/members`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-MEM-001 | At least one OWNER exists at all times | `AGG` + `DB` | Ownership transfer is atomic (demote + promote in one transaction) |
| I-MEM-002 | Role changes and removals require OWNER/ADMIN, and ADMIN cannot act on OWNER | `AGG` | Negative tests in T-SEC-003 |
| I-MEM-003 | Removal invalidates sessions and channel subscriptions in the same transaction | `AGG` | I-XA-004 restates it pairwise; this is the owning rule |
| I-MEM-004 | Removing a member reassigns or unassigns their open items (occurrences, issues, assigned alerts) | `AGG` | Half-assigned work is worse than unassigned work |
| I-MEM-005 **(extension)** | A removed member's historical activity entries are retained with a snapshotted display name | `AGG` | History must not be rewritten by a membership change |

## Rooms (`domain/rooms`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-ROOM-001 | Status is always exactly one of the five values (`CLEAN`, `NEEDS_ATTENTION`, `DIRTY`, `CLEANING`, `UNKNOWN`) and is always accompanied by a reason | `PURE` | No numeric score exists anywhere (ADR-010) |
| I-ROOM-002 | At most one active override per room | `DB` (partial unique where `expires_at > now()`) + `AGG` | Expired overrides are inert even before the sweep |
| I-ROOM-003 **(extension)** | Derivation is a pure, deterministic function with fixed precedence: override → IN_PROGRESS(`CLEANING`) → overdue(`DIRTY`) → due today(`NEEDS_ATTENTION`) → recent completion(`CLEAN`) → `UNKNOWN` | `PURE` | The precedence order is the whole design; property-tested for determinism |
| I-ROOM-004 | A room never alerts directly | `AGG` | Alerts come from the underlying work, so there is one reason to act |
| I-ROOM-005 **(extension)** | Not-in-use and archived rooms are excluded from derivation, lists, and alert evaluation | `AGG` | I-ROOM-005 also covers the "toggle back restores immediately" behaviour |

## Chores (`domain/chores`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-CHORE-001 | At most one open occurrence per definition | `DB` (partial unique index) | The anti-stacking guarantee (FR-CHORE-017) |
| I-CHORE-002 | Completion is idempotent per occurrence (a repeat is a no-op that returns the original result) | `AGG` + `clientRequestId` | Double taps, retries, stale tabs |
| I-CHORE-003 **(extension)** | `occurrence_key` is deterministic for a slot and unique per household | `DB` + `PURE` | Makes retries and late ticks safe |
| I-CHORE-004 **(extension)** | The next date is computed from the rule anchor (or the last completion for `AFTER_COMPLETION`), never from the tick time | `PURE` | A late tick must not shift a series |
| I-CHORE-005 | Skip does not advance a completion-anchored series | `AGG` | Tested explicitly (T-CHORE-007) |
| I-CHORE-006 | Snooze is bounded by the household maximum and attributed to the actor | `DB` + `AGG` | Records every snooze, not just the latest |
| I-CHORE-007 | Definitions never delete history: edits do not rewrite existing occurrences or completions | `AGG` | Occurrences snapshot the title and room for display |

## Trash (`domain/trash`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-TRASH-001 | Only documented state transitions are accepted | `AGG` | `TRASH_INVALID_TRANSITION` otherwise |
| I-TRASH-002 | Every transition writes a state event with actor, reason, and time | `DB` (append-only table) | FR-TRASH-006 |
| I-TRASH-003 | Completing a collection resets the state and closes the container's open trash alerts | `AGG` | Reason recorded as `COLLECTED` |
| I-TRASH-004 | Hysteresis: no automatic downgrades; a state change always has an actor or a collection completion | `AGG` | Prevents ALMOST_FULL/FULL flapping |
| I-TRASH-005 **(extension)** | A reset from `FULL` requires a reason | `AGG` | `TRASH_RESET_REASON_REQUIRED` |
| I-TRASH-006 **(extension)** | No schedule reminder is created for an EMPTY container | `PURE` (condition) | Avoids pointless prompts |

## Resources (`domain/resources`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-RES-001 | Levels are always interpretable in the resource's mode (mode-exhaustive level union) | `AGG` + `DB` (check constraints) | No "quantity: null" ambiguity |
| I-RES-002 | A mode change resets the level explicitly and is recorded; repeating the same mode is a no-op | `AGG` | `RESOURCE_MODE_CHANGE_REQUIRES_CONFIRM` |
| I-RES-003 | Restocking closes the need: it removes the item from the grouped alert and from derived shopping | `AGG` | Group resolves only when the list empties |
| I-RES-004 | Low/critical needs are grouped into one household alert per window | `PURE` (dedupe key) | Repeated updates never produce repeated alerts |
| I-RES-005 **(extension)** | Threshold-crossing events fire only on a transition (entering/leaving a band), at most once per direction per day | `AGG` | The core anti-fatigue rule for supplies |
| I-RES-006 **(extension)** | Target/par and thresholds are consistent with the mode: `EXACT` may define both, `APPROXIMATE` uses band levels, binary mode has no thresholds | `AGG` | `RESOURCE_THRESHOLD_INVALID` |

## Maintenance (`domain/maintenance`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-MNT-001 | `nextServiceAt` is always recomputable from records + frequency; never hand-edited, never advanced by an alert or snooze | `PURE` + `JOB` (recompute sweep, T-MNT-004) | The sweep also detects drift |
| I-MNT-002 | Completing a service records the actor or `EXTERNAL` | `AGG` | Vendor path uses a free-text note, never a fake member |
| I-MNT-003 | Paused plans produce no alerts and their open alerts resolve with reason `PAUSED` | `AGG` | Seasonal plans stay honest |
| I-MNT-004 | No work-order, approval, or parts concepts exist | `AGG` (no such types) + doc audit | ADR-012; an agent adding one is a regression |
| I-MNT-005 **(extension)** | Monthly clamping is stable across months (an "on the 31st" rule clamps per occurrence and never drifts to the 28th) | `PURE` | Mirrors the chore recurrence rule |
| I-MNT-006 **(extension)** | Cost and vendor notes are free text that never enters notifications, logs, metrics, or any aggregate | `AGG` + redaction tests | FR-MNT-012 / NG-2: no expense tracking |

## Issues (`domain/issues`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-ISSUE-001 | Only legal lifecycle transitions are accepted, and each appends an audit row | `AGG` | `ISSUE_INVALID_TRANSITION` |
| I-ISSUE-002 | `SAFETY` issues alert immediately and always reach at least one OWNER/ADMIN (quiet hours bypassed) | `PURE` (recipients) + policy | Hard requirement (T-ISSUE-003) |
| I-ISSUE-003 | Resolution is attributed (actor + time); `WONT_FIX` requires a reason | `AGG` | Makes the record honest |
| I-ISSUE-004 | Comments are append-only | `DB` (no update path) | Conversation is history |
| I-ISSUE-005 **(extension)** | A photo is never a precondition: reporting and resolving work with text alone, and an upload failure never blocks the report | `AGG` (two-phase create) | The "under 20 seconds" rule survives a bad network |
| I-ISSUE-006 **(extension)** | Closed issues reject new comments; a recurrence becomes a new linked issue | `AGG` | Keeps history linear |

## Alerts (`domain/alerts`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-ALERT-001 | At most one non-terminal alert per `(householdId, dedupeKey)` | `DB` (partial unique index) | The load-bearing anti-spam guarantee |
| I-ALERT-002 | Every alert answers the five questions (what, why it matters, who, what to do, when) | `AGG` (creation validates content) | Malformed alerts fail creation |
| I-ALERT-003 | Auto-resolution when the condition clears, with a recorded reason | `PURE` (reconciliation) | Re-running the engine changes nothing |
| I-ALERT-004 | Snooze is bounded by the household maximum and re-opens automatically | `DB` + `JOB` | Re-open happens on the tick, not on read |
| I-ALERT-005 | Escalation never creates a second alert; it changes the same row once per cooldown | `AGG` | IMPORTANT/URGENT only |
| I-ALERT-006 | Recipients are explicit and deterministic: assigned → role target → OWNER fallback; away members skipped unless URGENT | `PURE` | Never a broadcast (ADR-009) |
| I-ALERT-007 **(extension)** | Quiet hours and daily caps suppress **delivery**, never creation or in-app visibility | `PURE` (policy) | The dashboard is always complete |
| I-ALERT-008 **(extension)** | Acknowledging never resolves; only resolution removes the alert from open counts | `AGG` | "I've seen it" ≠ "it's fixed" |

## Activity (`domain/activity`)

| ID | Invariant | Enforced by | Notes |
| --- | --- | --- | --- |
| I-ACT-001 | Append-only: no update or delete path exists outside the prune job | `PORT` (no update method) + `DB` | Tamper-evident history |
| I-ACT-002 | Household-scoped | `DB` + `PORT` | I-XA-001 applies too |
| I-ACT-003 | No PII beyond ids and titles already visible in-app; metadata carries enums, ids, and counts only | `AGG` + redaction test | Prevents an accidental diary |
| I-ACT-004 | Pruned past the retention window by a job (default 12 months, configurable 3–24) | `JOB` (T-ACT-004) | Verified monthly in T-OPS-002 |
| I-ACT-005 **(extension)** | Titles are snapshots captured at write time, so history survives renames and archives | `AGG` | Also removes joins from the feed query |
| I-ACT-006 **(extension)** | No presence, view, or read events exist, and no per-member counting read model is derivable | `AGG` (no such type) + product audit T-ACT-006 | Deliberate anti-surveillance stance (PP-9) |

## How to add an invariant

1. State it as a negative test first ("it must be impossible to…").
2. Prefer a database constraint; fall back to an aggregate check; if neither works, name the job that restores it **and** the maximum window of inconsistency.
3. Add a row here, add the ID to DOMAIN.md §4 (for per-module rules) or §5 (for cross-aggregate rules), and add a test named `T-<AREA>-<NNN> <requirement> …`.
4. Never delete an invariant row: mark it superseded and link the ADR that superseded it.
