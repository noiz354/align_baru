# HomeOps Wave3 READINESS

**Project:** `homeops-household-manager-spec`
**Wave2:** `RUNNABLE_DEMO` (d92529e household→rooms→chores→Today→complete)
**Wave3:** `MVP_PARTIAL` — durable recurring `Buang sampah` lifecycle proven.

## New proven boundary

- `chore_definition` `recurrenceKind` DAILY/WEEKLY drives `chore_occurrence` with deterministic `occurrenceKey=${definitionId}:${dueOn}` unique per household (`uq_occurrence_household_key`).
- `POST /api/homeops/chores` creates definition + occurrence today (`2026-09-28`) with `status OPEN`; `GET /api/homeops/today?today=2026-09-28` lists it.
- `POST /api/homeops/chores/:id/complete` marks `COMPLETED` + `completedAt` + `completedByMemberId`, then computes `nextDueOn` (`+1` DAILY, `+7` WEEKLY, `+1M` MONTHLY) and `createOccurrence` with `onConflictDoNothing` → `nextOccurrence` `2026-09-29` OPEN. `GET /today?2026-09-28` now empty, `GET /today?2026-09-29` shows next, `GET /chores` shows exactly 2 rows.
- Idempotent double-complete: second POST to same id returns `deduped:true` same `completedAt`, does not create third row (early return + unique constraint).
- Tenant isolation: wrong `householdId` → 404, not 403 leak.
- Validation: missing `householdId` 422, short title 422, unknown occurrence 404.
- Weekly variant `Buang sampah mingguan` DAILY `2026-09-28` → weekly next `2026-10-05` (not 09-29) proves rule.
- PGlite durable `/tmp/homeops-pglite` survived `kill 4431` → restart PID 4564 Ready 439ms, list still 2 rows, Today 09-28 empty / 09-29 shows next.
- No duplicate next on reload/restart: deterministic key + `onConflictDoNothing` ensures exactly-once next even after crash-retry.
- Env now accepts `pglite://` for dev.

## Failure / isolation matrix

| Check | Result |
|-------|--------|
| Double complete same occurrence | 200 deduped:true same completedAt, list stays 2 |
| Wrong household on complete | 404 NOT_FOUND |
| Missing householdId on create | 422 VALIDATION_FAILED |
| Short title | 422 |
| Unknown occurrence | 404 |
| Weekly next due | 2026-10-05 (7 days) |
| Restart list | 2 rows persist |

## Impl commit

Implementation commit: `eb4fadd feat(homeops): add durable recurring chore lifecycle`.

## Wave2 regression

Household→rooms→chores→Today→complete still passes; no overwrite of `MVP_AUDIT/progress/homeops...` (frozen). Room and member FKs intact.

## Blocker to MVP_READY

Remains `MVP_PARTIAL` (not MVP_READY) because trash, resources, maintenance, notifications, alerts, scheduler not yet real; but recurring chore slice now real. Promotion `RUNNABLE_DEMO→MVP_PARTIAL` justified.

## Screenshots

No actual browser screenshots were captured. The prior deterministic placeholder images were removed; runtime behavior is documented in `RUNTIME_PROOF.md`.

## Next (per GLOBAL order) minimal → siomayops → strangerlink → rsi → parking.
