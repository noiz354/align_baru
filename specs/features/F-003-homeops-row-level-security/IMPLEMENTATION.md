# F-003 — Implementation plan

Two slices, roughly 2.5 hours. S1 must not start before `F-002-S1` has landed.

## F-003-S1 — Migration and policies (75 min)

1. Inventory the tenant tables:
   ```sql
   SELECT table_name FROM information_schema.columns
   WHERE table_schema='public' AND column_name='household_id';
   ```
   Expect: `household_member`, `room`, `chore_definition`, `chore_occurrence`, `household_settings`,
   `invitation`, and any table the inventory turns up. Add a test that re-runs this query.

2. Write `migrations/0002_row_level_security.sql`, modelled on
   `majelishub-pengajian-event-platform-spec/drizzle/0001_row_level_security.sql`:
   - `CREATE ROLE homeops_app NOLOGIN;` `ALTER ROLE … NOBYPASSRLS;`
   - `GRANT` to it, and the runtime user becomes a member of it.
   - Per table: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + one `PERMISSIVE FOR ALL`
     policy whose `USING` and `WITH CHECK` are
     `"household_id"::text = current_setting('app.household_id', true)`.
   - The `FORCE` clause is not optional: without it the table owner bypasses the policy, which is
     exactly the trap this feature exists to close.

3. **Register the migration in `migrations/meta/_journal.json`.** Read `F-004` — if the journal is
   still broken, this migration will silently not apply, and the whole feature will appear to work
   while doing nothing. Coordinate explicitly; that is the single highest-risk step in this slice.

4. Verify with AC-001, AC-002 and AC-006 by hand against a real PostgreSQL 18.4.

## F-003-S2 — Wire the session variable and test (75 min)

1. `src/server/db/client.ts` — add `app.household_id` to the statements the scoped transaction sets,
   and rename the helper to make the scope mandatory (`withHouseholdTransaction(db, ctx, fn)`) so an
   unscoped call is not expressible.
2. Route `F-002`'s `requireHousehold` context into it. `ctx.householdId` is the only source.
3. Write `tests/integration/security/row-level-security.test.ts` with AC-002…AC-005, AC-007, AC-008.
4. Confirm the harness actually reaches a real database — homeops' integration tier currently
   **skips** (`F-019`). A skipped suite here would make this feature unverifiable and therefore
   worthless. If `F-019` is not done, run the suite manually against a real server and record the
   output as the evidence.

## Verification
```
npm run typecheck && npm run lint && npm test && npm run build
INTEGRATION_DATABASE_URL=postgres://…/homeops_test npm run test:integration   # must not skip
psql -c "select relname from pg_class where relkind='r' and relrowsecurity"
```

## Do not touch
- The migration journal mechanics (`F-004` owns the fix; here you only add an entry).
- `authorize.ts` role logic (`F-002-S4`).
- Any page.
