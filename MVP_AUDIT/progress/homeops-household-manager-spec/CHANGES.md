# HomeOps Changes — Wave 2 (2026-09-28)

## Files changed

- `src/server/db/client.ts` — added PGlite branch (`pglite:///…`), `isPgliteUrl` helper, `getDb()` `drizzle-pglite` vs `drizzle-pg`, `getSql()` throws for PGlite, `pingDatabase()` dual, `isPgliteDb` helper, `closeDb()` handles both
- `src/server/db/schema/rooms.ts` — NEW: `room` table (id, householdId FK, name, groupLabel, sortOrder, notInUse, archivedAt, notes)
- `src/server/db/schema/chores.ts` — NEW: `choreDefinition` + `choreOccurrence` tables (householdId, definitionId, occurrenceKey unique per household, titleSnapshot, roomIdSnapshot, dueOn date, status enum OPEN/COMPLETED etc, assignee, snoozedUntil, completedAt/by)
- `migrations/0001_rooms_chores.sql` — create `chore_priority`/`occurrence_status` enums + `room` + `chore_definition` + `chore_occurrence` tables, FKs, indexes
- `src/server/db/repositories/rooms.ts` — NEW: `listRooms`, `findRoomById`, `createRoom`
- `src/server/db/repositories/chores.ts` — NEW: `listOccurrences`, `listTodayOccurrences` (`dueOn <= today AND status OPEN`), `findOccurrenceById`, `completeOccurrence` (`status COMPLETED`), `createOccurrence`, `createDefinition`
- `src/app/api/homeops/today/route.ts` — NEW: `GET /api/homeops/today?householdId=&today=` → Today query
- `src/app/api/homeops/chores/route.ts` — NEW: `GET /api/homeops/chores?householdId=` → list
- `src/app/api/homeops/chores/[id]/complete/route.ts` — NEW: `POST /api/homeops/chores/:id/complete` → complete
- `src/app/api/homeops/rooms/route.ts` — NEW: `GET /api/homeops/rooms?householdId=` → list
- `src/app/(household)/today/page.tsx` — rewrote to render `HomeOpsClient`
- `src/app/(household)/today/homeops-client.tsx` — NEW: Today dashboard (overdue+today, complete button, later, pglite note)
- `src/app/(household)/rooms/page.tsx` — NEW: client fetch rooms
- `src/app/(household)/chores/page.tsx` — NEW: client fetch chores
- `src/app/(household)/layout.tsx` — rewrote to render `children` (was `return null`)
- `scripts/seed-wave2-homeops.mjs` — NEW: deterministic 3 rooms + 5 chores (overdue/today×2/tomorrow/later) via PGlite `exec` migrations + `INSERT ON CONFLICT` raw SQL, household `594f4d49-3333...`

## Migrations

- `migrations/0001_rooms_chores` — applied via `pglite.exec` (idempotent)
- 0000 already applied (identity/tenancy/platform)

## Seed

`scripts/seed-wave2-homeops.mjs` — deterministic, rerunnable: 1 household Rumah Demo + 2 members + 3 rooms + 5 occurrences.

## No changes to projects 1-5

Projects 1-5 locked at `mvp-wave2-baseline-cc80bac`.
