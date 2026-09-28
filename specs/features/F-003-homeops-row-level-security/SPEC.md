# F-003 — homeops: row-level security on every tenant table

## User problem
HomeOps states that household isolation is its primary security boundary, and there is no such
boundary in the database. One careless query, one forgotten predicate, one new endpoint, and one
household reads another's private data. This is a backstop for a product whose whole premise is that
a home is private.

## Actor
The household member, as the beneficiary. The next engineer, as the risk they inherit.

## Current behavior
`grep -il "row level security\|CREATE POLICY" migrations/*.sql` → no matches.
`select relname from pg_class where relkind='r' and relrowsecurity` after applying every migration
→ `[]`. Seventeen tables, zero protected.

The pattern to adopt already exists and is proven in this repository: `majelishub`'s
`drizzle/0001_row_level_security.sql` + `src/server/db/client.ts::withScopedTransaction`. Verified on
real PostgreSQL 18.4 — with no scope variable the query returns `[]`; with a scope it returns only
that household's rows.

## Desired behavior
Every table that carries a `household_id` has RLS enabled and a policy keyed on
`app.household_id`, set transaction-locally from the `HouseholdContext` that `F-002` produces. A query
with no scope returns zero rows, not all rows. A `WITH CHECK` constraint blocks a cross-household
write. The application role is non-superuser with `NOBYPASSRLS`.

## Scope
- One new migration enabling RLS and adding policies on all tenant tables.
- `set_config('app.household_id', …, true)` inside the existing transaction helper.
- A test that enumerates `pg_class` and fails if any table with a `household_id` column lacks RLS.

## Explicit non-goals
- Platform/global tables (`user`, `account`, `session`, `verification`, `rate_limit_bucket`,
  `idempotency_key`, `scheduler_job_run`, `outbox_message`, `activity_event` — the last two are
  cross-household by design and need a composite policy or none). `majelishub`'s `drizzle/0001`
  documents this exemption list; copy its reasoning.
- Changing the connection role. homeops connects as a single role today; `F-018` may split it.
- Performance tuning. Add the policy first, measure second.

## User flow
Not user-visible. This is a backstop that must be invisible when the application is correct.

## Business rules
- RLS is the **second** layer. The scoped `WHERE` clause in the repository remains the first.
- Fail closed: a missing session variable yields `NULL`, the comparison fails, the policy is not
  satisfied, zero rows.
- `PLATFORM`-style cross-household access is a documented, reason-required, audited exception — or it
  does not exist. homeops has no such role today, so omit it.

## API contract
No change. Any change here is a bug elsewhere.

## Data model changes
None. Policies only.

## Authorization rules
The database knows one thing: which household. Role checks stay in the application (`F-002-S4`).

## Validation rules
n/a.

## Error behavior
n/a. RLS returns zero rows; it does not raise.

## Idempotency / concurrency
`set_config(..., true)` is transaction-local, so a pooled connection never carries one household into
the next request. This is the property that makes the design safe under concurrency, and it must be
asserted by a test.

## UI behavior
None.

## Observability
None required. A policy silently returning zero rows is a correct outcome, not an event. If a
`FORCE`-role violation ever needs surfacing, that is a `P0` incident, not a metric.

## Acceptance criteria
See `ACCEPTANCE.md`.

## Dependencies
**F-002** — the transaction must receive a `HouseholdContext` to set the variable. On an independent
schedule from **F-004**.

## Impacted files/modules
- new: `migrations/0002_row_level_security.sql` (+ journal entry)
- `src/server/db/client.ts` — the scoped transaction helper
- `src/server/db/repositories/*.ts` — no signature change expected
- new: `tests/integration/security/row-level-security.test.ts`
- `SECURITY.md` — restate P-1 with the database layer named

## Migration strategy
Forward-only, additive. `ALTER TABLE … ENABLE ROW LEVEL SECURITY` takes `ACCESS EXCLUSIVE` briefly.
On an empty or small table that is instant; on a populated deployment, run it in a maintenance
window. `ALTER TABLE … FORCE ROW LEVEL SECURITY` is required so the table owner is also subject to
the policy.

**Ordering with F-004 matters:** the journal is currently broken, so a new migration may not be
applied. Coordinate: `F-004-S1` first, or land both in one change.

## Rollback considerations
`ALTER TABLE … DISABLE ROW LEVEL SECURITY` restores the previous behaviour immediately and is safe
only while the application layer is correct. Rolling back this feature while `F-002` is in place
reintroduces GAP-P0-HOM-02 silently. Record that in the rollback note.
