# ADR-006: Domain Task Model — Chore Definition vs Occurrence vs Completion

## Status
Accepted

## Date
2026-09-26

## Context
Household work has three distinguishable things: the *routine* ("clean the bathroom, weekly, high priority"), the *scheduled instance* ("bathroom due Friday"), and the *act* ("Budi cleaned the bathroom on Friday 18:40"). Existing-tool failures come from collapsing these: a repeating to-do that is checked off and vanishes loses history; a task list that never materialises occurrences cannot show "due today"; a completion stored only as a status flag cannot answer "who did this and when". HomeOps also needs skip, snooze, reassign, and pause behaviours that only make sense at the occurrence level, and it needs recurrence (ADR-007) computed from either the calendar or the last completion.

## Problem
What entity decomposition makes recurring household work schedulable, completable, auditable, and reschedulable — without turning into a project-management system (tasks, subtasks, dependencies, statuses, boards)?

## Decision Drivers
- History must survive (FR-CHORE-020) while definitions stay editable.
- "Due today / overdue" must be a query over planned instances, not a computation at render time.
- One-tap completion must be idempotent (FR-CHORE-005).
- Skip/snooze/reassign/pause need a place to live (FR-CHORE-007..009, FR-CHORE-018).
- Completion-based recurrence requires a durable `lastCompletedAt` (FR-CHORE-015).
- Must stay comprehensible to non-project-manager users: three concepts maximum in the UI.

## Options Considered
1. **Definition + occurrence + completion** (three entities) — explicit scheduled instances, full history, one open occurrence per definition (FR-CHORE-017).
2. **Definition + completion only** (compute "due" at query time) — fewer tables; every read recomputes schedules; skip/snooze have nowhere natural to live; "overdue since" becomes ambiguous.
3. **Single task row mutated on completion** (like most to-do apps) — simplest; loses per-occurrence history and cannot express "the 12th was skipped".
4. **Full task-management model (projects, areas, dependencies, subtasks, workflow states)** — rejected: enterprise weight, and it pushes the product toward tracking people (PRD NG-3).
5. **Calendar-event model (all work becomes dated events)** — natural for recurrence, awkward for completion semantics and for "no stacking".

## Decision
Adopt **(1)**, with a deliberately small field set:

| Entity | Role | Key properties |
| --- | --- | --- |
| `ChoreDefinition` | The reusable routine | title, description?, roomId?, priority, assigneeId?, recurrence?, estimatedMinutes?, isPaused, archivedAt? |
| `ChoreOccurrence` | One planned instance | definitionId, dueAt (instant) + dueDate (civil), status, assigneeId?, snoozedTo?, source (`SCHEDULED` \| `AD_HOC` \| `MANUAL`), occurrenceKey |
| `ChoreCompletion` | One recorded act | occurrenceId, completedById, completedAt, note?, photoId?, skipped?: boolean, skipReason? |

Rules:
- **Definition edits never rewrite history.** Editing a recurring definition affects future materialisation only.
- **At most one open occurrence per definition** (FR-CHORE-017). Materialisation is idempotent via `occurrenceKey` (unique per definition + scheduled civil date/period).
- **Completion is a record, not a status flip.** The occurrence's status is derived from its completions/skip state; the completion row is the audit truth (FR-CHORE-004).
- **Skip ≠ delete.** A skipped occurrence stays visible in history with a reason (FR-CHORE-007).
- **Snooze** writes `snoozedTo` on the occurrence and records the actor; it never touches the definition.
- **Ad-hoc chores** create a definition-less occurrence with `source = AD_HOC` (FR-CHORE-010), optionally promotable to a definition later (out of scope for v1).
- **Chore is not maintenance.** Chores are human routines; maintenance plans attach to assets and carry service history (ADR-012). A chore is never used to model an appliance service.
- **No dependencies, no subtasks, no boards, no estimates used for scoring.** `estimatedMinutes` is display-only (FR-CHORE-012).

## Consequences

### Positive
- "Due today", "overdue", and "next up" are simple indexed queries over occurrences.
- History is answerable per definition, per occurrence, and per member without scanning audit logs.
- Recurrence stays a pure function of definition + last completion (ADR-007) — testable in isolation.
- Skip/snooze/reassign/pause all have a natural home, and their effects are visible rather than implicit.
- The dashboard read model needs one contract per list, not per-status logic.

### Negative
- Three tables instead of one; more joins and more code for simple flows.
- Materialisation must run (scheduler, ADR-013) or the app shows nothing for a new definition — a dependency between scheduling and basic usefulness.
- Users can be confused by "definition vs occurrence" if the UI exposes both poorly; the UI must present "chores" (definition view) and "what's due" (occurrence view) distinctly (docs/design/PAGES.md).
- Editing a definition while an occurrence is open requires an explicit reconciliation rule (documented, and a test edge case: T-CHORE-013).
- More invariants to enforce (one-open-occurrence, idempotent keys, snooze bounds).

## Risks
| Risk | Impact |
| --- | --- |
| Duplicate occurrences from a race in materialisation | Confusing duplicate chores |
| Orphan occurrences after definition archival | Lost history or ghost chores |
| Snooze used as a permanent dodge | Alert fatigue avoided by hiding work |
| Definition edits silently changing open occurrences | Members see unexplained changes |

## Mitigations
- Unique constraint on `(household_id, definition_id, occurrence_key)` plus `ON CONFLICT DO NOTHING` semantics; the scheduler is single-flight (ADR-013).
- Archival is soft; occurrences keep a nullable-but-resolvable reference and history renders "archived chore".
- Snooze is bounded (max horizon per household setting) and every snooze is recorded and visible in activity (T-ACT).
- Definition edits write an activity record and surface a note on open occurrences ("definition changed after this was scheduled").
- Domain tests (skeletons in tests/unit/domain/chores/) cover the invariants: one-open-occurrence, idempotent completion, snooze bounds, skip retention.

## Revisit Conditions
- Real usage shows definitions are nearly always 1:1 with occurrences (would justify collapsing concepts).
- A requirement appears for multi-step chores (would need a subtask model — currently a non-goal).
- Materialisation complexity causes persistent stale/duplicate occurrences in production.

## References
- PRD.md — FR-CHORE-001..020
- docs/product/CHORES.md, docs/product/RECURRENCE.md
- DOMAIN.md — §Chores aggregate
- DATA_MODEL.md — `chore_definition`, `chore_occurrence`, `chore_completion`
- ADR-007 (recurrence), ADR-012 (maintenance separation)
- TASKS.md — T-CHORE-001..020
