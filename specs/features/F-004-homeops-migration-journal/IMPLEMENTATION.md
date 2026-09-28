# F-004 — Implementation plan

Two slices, roughly 90 minutes total. **Do this one first** — it is the cheapest fix in the plan and
everything else in homeops is unprovable until it lands.

## F-004-S1 — Make the migration set honest (30 min)

1. Read `migrations/0001_rooms_chores.sql`. Confirm it is the file the seed script's raw SQL matches.
2. Generate the missing snapshot:
   ```
   npx drizzle-kit generate    # produces meta/0001_snapshot.json
   ```
   If drizzle-kit wants to generate a *new* migration instead, the schema in `src/server/db/schema.ts`
   has drifted from the SQL. Reconcile by hand and record the decision — do not let the tool invent a
   third version.
3. Add the `0001` entry to `migrations/meta/_journal.json` with a `when` timestamp after `0000`'s.
4. Add the "unregistered file" assertion to `scripts/migrate.ts` — compare the `.sql` files on disk
   against the journal and exit non-zero on a difference in either direction.
5. Add `tests/unit/ops/migration-completeness.test.ts` with AC-001 and AC-005.

Verify: `createdb homeops_fresh && npm run db:migrate && psql -c '\dt'` → 17 tables (AC-002, AC-004).

## F-004-S2 — Boot-time schema check and seed cleanup (60 min)

1. `src/server/db/schema-version.ts` — read the highest applied migration from drizzle's bookkeeping
   table; export `requiredSchemaVersion()` and `assertSchemaIsCurrent()`.
2. Call `assertSchemaIsCurrent()` once during module initialisation of the DB client, so an
   un-migrated database produces one clear error at boot instead of `42P01` per request.
3. `scripts/seed-wave2-homeops.mjs` — delete the `ensureTablesWithPglite` path. Seeding now requires a
   migrated database and may only insert rows. Update its header comment, which currently says
   "no RLS bypass needed" and is the reason the gap was invisible.
4. Add `tests/unit/ops/schema-version.test.ts` with AC-007.

## Verification
```
npm run typecheck && npm run lint && npm test && npm run build
createdb homeops_fresh
DATABASE_URL=postgres://…/homeops_fresh npm run db:migrate
psql -d homeops_fresh -c '\dt' | wc -l
```

## Do not touch
- The contents of the `.sql` files. Forward-only.
- RLS policies (`F-003` will add `0002`).
- Any route or page.
