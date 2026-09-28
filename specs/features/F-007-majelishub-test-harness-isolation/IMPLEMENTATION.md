# F-007 — Implementation plan

Three slices, roughly 3 hours.

## F-007-S1 — Per-suite isolation (90 min) — unblocks the most

1. `tests/support/db.ts`, `createTestDatabase()`:
   - prefer a **per-suite schema** over a per-suite database: cheaper, and it keeps
     `INTEGRATION_DATABASE_URL` pointing at one place.
     ```ts
     const schema = `itest_${randomUUID().replace(/-/g, "")}`;
     await exec(`CREATE SCHEMA ${schema}`);
     await exec(`SET search_path TO ${schema}`);
     ```
   - the schema name is validated by the same identifier regex `src/server/db/client.ts` already uses
     for the app role — never interpolate anything else;
   - `close()` drops the schema;
   - assign `harness` before any code that can throw, so `afterAll` cannot produce the
     `Cannot read properties of undefined` cascade.
2. Migrate the suites that hand-roll setup (`tests/integration/identity/auth-round-trip.test.ts`
   builds its own auth instance) onto the shared helper.
3. Consolidate `tests/support/database.ts` into `db.ts` (AC-009).

Verify: AC-001, AC-002, AC-004, AC-005.

## F-007-S2 — Driver parity (45 min)

1. Find why `chain_position` differs. Inspect the column type in `drizzle/0002_audit_events.sql`; if
   it is `bigint`, `node-postgres` returns a string by design. The fix is a **consistent contract**:
   either widen to `int` in a new migration (if the column will never exceed 2^31) or map the value
   in the repository. **Do not** fix it with `Number(x)` at the assertion — that hides the divergence
   rather than resolving it.
2. Add `tests/integration/security/driver-parity.test.ts` running the same query on both engines and
   comparing JS types.
3. Fix `audit/coverage.test.ts` accordingly (AC-003).

Verify: AC-003; the whole suite must be green on **both** engines.

## F-007-S3 — Engine honesty and CI (45 min)

1. `tests/support/env.ts` — log the engine on first use, with the explicit warning that PGlite does
   not enforce RLS (AC-006).
2. Make RLS-dependent assertions `skipIf(!isExternalServer)` **with a visible reason**, so a PGlite run
   reports a skip rather than a false pass.
3. Add `majelishub-integration` to `.github/workflows/project-checks.yml` with a `postgres:18` service
   and `npm run db:migrate` before the test step. No `continue-on-error` (AC-007).
4. Update `TESTING.md` §1.3 with one paragraph: *PGlite is a hermetic harness, not production
   evidence. Any claim about persistence or RLS must be backed by a run against a real PostgreSQL.*

Verify: AC-006, AC-007, AC-008.

## Verification
```
npm run typecheck && npm run lint && npm test && npm run build
INTEGRATION_DATABASE_URL=… npx vitest run --project integration     # exit 0
npx vitest run --project integration                                # pglite, still green
```

## Do not touch
- Any product code. This feature is test infrastructure; if it appears to need a product change, stop
  and open an issue — that is a real finding, not a task for this slice.
- The 281 todo tests.
