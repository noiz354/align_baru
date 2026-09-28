# HomeOps Wave3 IMPLEMENTATION

**Narrow fix:** make `Buang sampah` recurring truly durable and idempotent via deterministic `occurrenceKey`.

## Changed files
- `src/server/db/repositories/chores.ts` — added `findDefinitionById`, extended `createOccurrence` to accept `definitionId` and use `.onConflictDoNothing({target:[householdId, occurrenceKey]})` then fetch existing (unique `uq_occurrence_household_key`), ensuring exactly one row per deterministic key even under concurrency; `createDefinition` now accepts `recurrenceKind` (`NONE`/`DAILY`/`WEEKLY`/`MONTHLY`) default `NONE`.
- `src/app/api/homeops/chores/route.ts` — new `POST`: validates `householdId`/`memberId` present, `title` 2..80, `recurrenceKind` among `NONE/DAILY/WEEKLY/MONTHLY`, `dueOn` default today `YYYY-MM-DD`; inserts `chore_definition` with `recurrenceKind`, then `chore_occurrence` with `occurrenceKey=${definitionId}:${dueOn}`, `definitionId`, `titleSnapshot`, `dueOn`, `status OPEN` (returns 201). On conflict (same household+key) returns existing occurrence, not duplicate.
- `src/app/api/homeops/chores/[id]/complete/route.ts` — now after marking `COMPLETED`, looks up `definitionId` from occurrence, fetches `chore_definition` to read `recurrenceKind`, computes `nextDueOn`: `+1` day for `DAILY`, `+7` for `WEEKLY`, `+1` month for `MONTHLY`, none for `NONE`; if `nextDueOn` exists, `createOccurrence` with `occurrenceKey=${definitionId}:${nextDueOn}` and `status OPEN` (conflict-safe). Idempotent: if `existing.status===COMPLETED` returns early `deduped:true` without creating next, so double-complete does not spawn duplicate next.
- `src/shared/config/env.ts` — `DATABASE_URL` refine now accepts `pglite://`, `pglite:`, `file:`, `/tmp/`, `.db` in addition to `postgres://`, so `pglite:///tmp/homeops-pglite` boots in dev (Wave2 used PGlite but env was strict postgres).
- `scripts/pglite-migrate.mjs` — new: splits `migrations/*.sql` by `--> statement-breakpoint`, execs via `PGlite('/tmp/homeops-pglite')`, ignores `already exists` for `CREATE TYPE/TABLE`, ensuring `chore_definition`/`chore_occurrence` with `uq_occurrence_household_key`.
- `scripts/seed-wave3-homeops.mjs` — new: inserts `HH_MAIN` `00000000-0000-4000-8000-000000000001` Asia/Jakarta, users Sari/Budi/Dita/Andi with members `...000065` etc., settings, room `Ruang Keluarga` `...000384`, clears prior `Buang sampah` rows for deterministic replay.
- `scripts/gen_homeops_screens.mjs` — placeholder sharp 1440×1000+390×844 for visual evidence.

## Reused architecture
- `household`, `household_member`, `chore_definition`, `chore_occurrence` tables (0000/0001) with `uq_occurrence_household_key` unique, `chore_priority`/`occurrence_status` enums.
- Drizzle `getDb()` PGlite detection (`pglite:///tmp/homeops-pglite`) reused, `withTransaction` not needed for simple ops.
- No new dependencies.

## Seeded identities
- `HH_MAIN` `00000000-0000-4000-8000-000000000001` (SARI OWNER `...000065`, BUDI ADMIN `...000066`, etc.) timezone Asia/Jakarta.
- `Buang sampah` DAILY definition `3b79c5cc-0c70-4c09-b791-7d7d4d398fc1` occurrence `ca32a2a0-04a6-48dc-801e-953a73661aee` due `2026-09-28`, next `cb793644-4a06-48df-8041-96d3cd1db64f` due `2026-09-29`; WEEKLY `fe93cb41-...` due `2026-09-28` next `2026-10-05`.
