# F-007 — majelishub: the integration suite must be able to run against real PostgreSQL

## User problem
No one can verify anything about persistence in this project. The suite cannot run as a batch on a
real database, the one real database run hides a driver divergence, and the default PGlite path skips
row-level security entirely — so a green run proves nothing about production behaviour.

## Actor
The engineer who has to know whether a change is safe. Indirectly: every attendee whose check-in
depends on the audit chain.

## Current behavior

**Batch execution fails.** `INTEGRATION_DATABASE_URL=… npx vitest run --project integration` →
6 files fail with `relation "users" already exists`. `tests/support/db.ts` names the cause itself:
*"the full harness — containers, isolated schema per suite, seed generator — is `T-TEST-001`."*
`T-TEST-001` is not delivered, and 6 of the project's 10 "delivered" tasks are unaffected by it.

**Per-suite execution works, and reveals a real failure.** With `DROP SCHEMA public CASCADE` between
suites on PostgreSQL 18.4: 8 suites pass (52 tests), and `audit/coverage.test.ts` fails:

```
× writes an entry for every reason-required permission
AssertionError: expected [ '1', '2', '3', '4', '5', '6', …(4) ] to deeply equal [ 1, 2, …, 10 ]
```

`chain_position` is a string from `node-postgres` and a number from PGlite. The PGlite-only default in
CI concealed a driver divergence in the audit chain — the one subsystem the product's trust story
depends on.

**PGlite does not enforce RLS.** `withScopedTransaction` returns a bare transaction when
`isPglite`, and `scripts/pglite-migrate.mjs` explicitly skips `ENABLE RLS`, `CREATE POLICY`,
`GRANT`/`REVOKE` and `ALTER ROLE`. Every RLS claim in `MVP_AUDIT` was produced on a database with no
row-level security at all.

## Desired behavior
`npx vitest run --project integration` runs green against a real PostgreSQL 18, all suites in one
invocation, with per-suite isolation, and with a driver-parity assertion that would have caught the
`chain_position` divergence.

## Scope
- Schema-per-suite isolation in `tests/support/db.ts` (a unique schema per suite, or a unique database
  per worker, or `DROP SCHEMA public CASCADE` in `beforeEach`).
- A shared helper so no suite reimplements setup.
- `chain_position` typed consistently across drivers; the assertion fixed.
- An explicit, loud statement in the harness that **PGlite is not evidence for RLS or persistence**,
  and a CI job that runs this tier against a real PostgreSQL service.

## Explicit non-goals
- Container orchestration. `embedded-postgres` works and is fast; a compose file is not required.
- A browser/e2e tier.
- Test speed optimisation beyond isolation.
- Writing the 281 todo tests. This feature makes the harness *able* to run them; it does not write them.

## User flow
Not user-visible. It is the precondition for every other claim in this project.

## Business rules
- A test may not pass because the database under it lacks the property being tested. If a suite
  asserts RLS, it must run on a role for which RLS applies.
- The default for the integration project in CI is a real PostgreSQL service, not PGlite.
- PGlite may remain the *local, no-container* default for unit-adjacent speed, provided the harness
  logs which engine it used and the result is not quoted as production evidence.

## API contract
None. Test infrastructure only.

## Data model changes
None.

## Authorization rules
The harness must connect as the non-superuser application role for any RLS assertion, and as the
owner for schema setup. `tests/support/db.ts` already exports `TEST_APP_ROLE`; use it.

## Validation rules
`INTEGRATION_DATABASE_URL`, when set, must be reachable or the suite must **fail**, not skip. A skip
must be explicit and reported (`--reporter` shows it).

## Error behavior
A harness setup failure is a test failure. The current
`TypeError: Cannot read properties of undefined (reading 'close')` in `afterAll` after a failed
`beforeAll` should be fixed by assigning the harness before anything can throw.

## Idempotency / concurrency
Each suite must be independent and repeatable in any order. Isolation is what makes that true.
Under `--no-file-parallelism`, sequential isolation is sufficient; under parallel workers, use a
per-worker database.

## UI behavior
None.

## Observability
Log the engine (`pglite` / `postgres <version>`), the database name, and the applied migration count
once per suite. A future reader must be able to tell from the output which one ran.

## Acceptance criteria
See `ACCEPTANCE.md`.

## Dependencies
None. Independent of `F-005`/`F-006`, and can run in parallel with them.

## Impacted files/modules
- `tests/support/db.ts`
- `tests/support/database.ts` (the second harness; consolidate)
- `tests/integration/audit/coverage.test.ts`
- `tests/support/env.ts` (log the engine)
- `.github/workflows/project-checks.yml` (add a PostgreSQL service job for majelishub)
- `TESTING.md` §1.3 (PGlite is a harness, not evidence)

## Migration strategy
None.

## Rollback considerations
None. This feature only makes existing assertions honest.
