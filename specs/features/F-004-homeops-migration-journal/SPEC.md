# F-004 — homeops: the deploy migration must create the domain tables

## User problem
A deployment reports success and the application then returns `500` for every core request. Nobody
finds out until a household member does. The deploy pipeline is silently broken.

## Actor
The operator running a deploy. The household member who hits the error.

## Current behavior
`migrations/` contains `0000_identity_tenancy_platform.sql` and `0001_rooms_chores.sql`.
`migrations/meta/_journal.json` contains **one** entry, for `0000`.
`scripts/migrate.ts` calls drizzle's migrator against that journal.

Measured on real PostgreSQL 18.4:
```
$ npm run db:migrate
migrations applied to homeops_test in 2170 ms        # exit 0
$ psql -c '\dt'   → 14 tables; no room, no chore_definition, no chore_occurrence
$ curl /api/homeops/today   → 500  relation "chore_occurrence" does not exist  (42P01)
```

`0001` also has no `meta/0001_snapshot.json`, which is consistent with it never having been
generated. The reason it was never noticed: the wave-2/3 evidence was produced against a PGlite file
where `scripts/seed-wave2-homeops.mjs` creates those tables with raw SQL.

## Desired behavior
`npm run db:migrate` applies every migration file, creates all 17 tables, and reports honestly.
The application refuses to serve traffic when the code is ahead of the schema.

## Scope
- Make the migration set complete and self-describing.
- Add a schema-version check at boot.
- Move schema creation out of the seed script.

## Explicit non-goals
- Rewriting the existing migration files. They are committed and forward-only.
- Introducing a migration framework. homeops already has drizzle configured; the mechanism is
  correct, the bookkeeping is not.
- A `db:rollback`. Forward-only is the stated policy; keep it.

## User flow
Not user-visible. It is the condition under which every other user flow can run at all.

## Business rules
- A migration that is not registered does not exist. Registration and file creation are one commit.
- A seed script may insert rows. It may never create schema. (This rule is what hid the defect.)
- The app must not start against a database whose schema is behind the code.

## API contract
No change.

## Data model changes
None beyond making `0001` real.

## Authorization rules
n/a.

## Validation rules
`db:migrate` refuses a production-looking database name without `--i-know-this-is-production`. That
guard already exists (`scripts/migrate.ts`) — keep it.

## Error behavior
- Missing migration file for a journal entry → fail loudly at migrate time.
- Migration file with no journal entry → `db:migrate` must **fail**, not skip. A silent skip is the
  defect.
- Boot with a schema behind the code → the process refuses to start with an actionable message.

## Idempotency / concurrency
Migrations run once, tracked in drizzle's `__drizzle_migrations` table. Re-running must be a no-op.

## UI behavior
None.

## Observability
Log the applied migration count and the resulting schema version at boot. Emit a
`schema.version_mismatch` event when refusing to start.

## Acceptance criteria
See `ACCEPTANCE.md`.

## Dependencies
None. **This is the cheapest P0 in the workspace and blocks the demonstration of every other homeops
fix** — `F-002` will look broken (500) until this lands.

## Impacted files/modules
- `migrations/meta/_journal.json` — add the `0001` entry
- new: `migrations/meta/0001_snapshot.json` — generate with `drizzle-kit`
- `scripts/seed-wave2-homeops.mjs` — delete the `CREATE TABLE` path
- new: `src/server/db/schema-version.ts` + a boot check
- `scripts/migrate.ts` — add the "unregistered file" assertion
- new: `tests/unit/ops/migration-completeness.test.ts`

## Migration strategy
This feature *is* the migration strategy. Apply `0001` to a database that has already had it applied
by hand (the audit environment) and confirm the runner is a no-op.

## Rollback considerations
Removing the journal entry would restore the silent skip. If the migration itself is wrong, roll it
forward with a `0003`, never back.
