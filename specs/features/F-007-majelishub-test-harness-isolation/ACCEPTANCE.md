# F-007 — Acceptance criteria

## AC-001 — the whole integration project runs in one invocation on real PostgreSQL
```bash
INTEGRATION_DATABASE_URL=postgres://audit:audit@127.0.0.1:5432/majelishub_test \
  npx vitest run --project integration
# exit 0, zero "already exists" errors, zero skipped files
```

## AC-002 — suites are independent and order-insensitive
Run the same invocation twice; identical results. Run a single suite alone; identical result.
```bash
INTEGRATION_DATABASE_URL=… npx vitest run --project integration tests/integration/security/isolation.test.ts
# 5 passed
```

## AC-003 — the driver divergence is fixed, not hidden
```ts
// tests/integration/audit/coverage.test.ts
const positions = rows.map(r => r.chainPosition);
expect(positions.every(p => typeof p === "number")).toBe(true);
```
This must pass on **both** engines. Add it as a dedicated parity test so the two drivers cannot drift
again:
```ts
// tests/integration/security/driver-parity.test.ts
// assert the same query returns the same JS types under pglite and node-postgres
```

## AC-004 — a suite that cannot set up is a failure, not a cascade
The `TypeError: Cannot read properties of undefined (reading 'close')` in `afterAll` must not occur.
`harness` is assigned before anything that can throw, or `afterAll` guards on it.

## AC-005 — an unreachable `INTEGRATION_DATABASE_URL` fails
```bash
INTEGRATION_DATABASE_URL=postgres://nope@127.0.0.1:1/x npx vitest run --project integration
# must exit non-zero with a connection error, not skip 57 files
```

## AC-006 — PGlite is never cited as RLS evidence
```ts
// tests/integration/security/isolation.test.ts
// the layer-3 assertion must be skipped explicitly on PGlite, with a reason, and the skip must be
// visible in the report — not silently produce a pass
test.skipIf(!harness.isExternalServer)("refuses an unscoped query via RLS", …);
```
And the harness must log which engine ran:
```
[integration] engine=postgres 18.4 db=majelishub_test migrations=6
[integration] engine=pglite db=:memory: migrations=6  ⚠ RLS NOT ENFORCED
```

## AC-007 — CI runs this tier against a real PostgreSQL
```yaml
majelishub-integration:
  services:
    postgres: { image: postgres:18.6-bookworm, … }
  env: { INTEGRATION_DATABASE_URL: postgres://…@127.0.0.1:5432/majelishub_test }
  steps: [ checkout, setup-node 24, npm ci, npm run db:migrate, npm run test:integration ]
```
Assert the job exists and is not `continue-on-error`.

## AC-008 — the unit and integration projects still pass unchanged
```bash
npm test    # same counts as before this change, no new skips
```

## AC-009 — the harness is one harness
`tests/support/db.ts` and `tests/support/database.ts` currently duplicate the job. Consolidate to one
`createTestDatabase()`; a second copy is how the isolation gap survived.
