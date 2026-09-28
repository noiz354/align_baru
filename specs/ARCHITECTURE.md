# ARCHITECTURE

## What is actually shared, and what is not

The eight folders are independent. There is no shared package, no shared database, no shared build.
The only cross-project coupling is the **repository root**: `AGENTS.md`, `HARNESS.md`,
`scripts/check-claims.mjs`, `scripts/check-harness-preflight.mjs`, and
`.github/workflows/project-checks.yml`. Every cross-project defect in this plan is in that root or is
a documentation claim inside one folder.

The practical consequence for planning: **work inside a folder is parallel-safe across folders.** The
serial dependencies are entirely within a folder, plus the root CI file.

## The five patterns that already exist and should be reused

These are not proposals. Each is present, working, and — in four of five cases — already proven by a
passing test. Re-implementing any of them in another project would be a regression.

### 1. Scoped transaction with RLS session variables — `majelishub`

`src/server/db/client.ts`:

```
withScopedTransaction(db, scope, fn)
  → assertScopeUsable(scope)
  → set_config('app.organization_id', …, true)   // transaction-local
  → set_config('app.scope',        …, true)
  → set_config('app.mosque_id'/'app.event_id'/'app.user_id', …, true)
  → SET LOCAL ROLE majelishub_app               // non-superuser, NOBYPASSRLS
  → fn(tx)
```

**Proven on real PostgreSQL 18.4** (see `SECURITY_GAPS.md`): no scope → zero rows; Org A scope → Org
A's rows only. This is the pattern `homeops` adopts wholesale in `F-003`.

Two things must be carried over *with* the pattern: the `NOLOGIN` application role with
`ALTER ROLE … NOBYPASSRLS`, and the fail-closed `assertScopeUsable` before any statement runs.

### 2. Scope as a mandatory first parameter — `majelishub`

Every repository function in `majelishub/src/server/db/repositories/` takes a `TenantScope` before any
data argument, so an unscoped call is not expressible in the type system. `tenancy.ts` and `mosques.ts`
say so in their own headers; `isolation.test.ts` proves both layers independently.

`homeops`' `repositories/` take a bare `householdId: string`, which is why a caller can pass a query
parameter straight through. `F-002` changes the signature.

### 3. Data-driven authorization matrix — `majelishub`

`src/shared/contracts/permissions.ts` declares 53 permission keys; `src/server/auth/permissions.ts`
declares a 9-role × 53-permission matrix as data;
`tests/integration/security/permissions.test.ts` walks **every cell** and asserts the documented
outcome, then requires every mutating route to pass through `requirePermission` or be listed in
`public-routes.ts` with a reason.

Two defects to fix rather than copy: the route check is a **string search** (see `F-005`), and it
asserts counts instead of properties (`F-007`).

`siomayops` has the same idea in `src/server/auth/port.ts::ROLE_PERMISSIONS` for 8 roles — the matrix
is sound; the *session* feeding it is the bug.

### 4. Deny by default on absence — all projects, unevenly

`strangerlink`'s `banStore.isBanned` check is evaluated **before** candidate selection and fails
closed. `siomayops`' webhook verifier rejects on missing secret. `parking`'s watchlist returns `None`
(harmless — it never grants). These are the correct shapes.

The inverse also exists and must be treated as a defect: `homeops` treats "no session" as "use the
caller's household id", and `majelishub` treats "no header" as "`majelishub-jakarta-admin`".

### 5. Idempotency at the mutation boundary — `siomayops` (partially)

`withIdempotency({organizationId, route, idempotencyKey, requestHash, actorId}, fn)` with replay
marking, hash-mismatch `422`, and concurrent dedup. The design is right; `F-009` makes the key
**required** rather than optional.

## What must NOT be copied

| Anti-pattern | Where it lives | Why it is dangerous |
|---|---|---|
| PGlite as the evidence database | majelishub (all `MVP_AUDIT` RLS claims), homeops (all wave-2/3 claims) | `withScopedTransaction` short-circuits to a bare transaction and `pglite-migrate.mjs` skips `ENABLE RLS` / `CREATE POLICY`. The dev database has **no RLS at all**, so a screenshot from it proves nothing about production behaviour. It also hid a real driver divergence (`F-007`). |
| Identity from a request header or query parameter | majelishub (`x-majelishub-user`), homeops (`x-homeops-household`, `?householdId=`) | Authentication that the client supplies. `strangerlink`'s `x-homeops-`-style identifiers are fine for *transport*; never for *identity*. |
| A "durable-like" store holding safety records | strangerlink `in-memory.ts` | Ephemeral state may be in memory. Bans and reports may not. |
| Seed scripts that create tables | homeops `seed-wave2-homeops.mjs` (raw SQL) | This is what hid `GAP-P0-HOM-03`: the app works on the seeded PGlite file and 500s on a migrated PostgreSQL. Seeds may insert rows; they may never create schema. |
| Gate scripts that nothing runs | majelishub `verify:vs0`, siomayops `check-stubs`/`census`, manga (no lint), strangerlink (`eslint` missing), all five non-yomi projects in CI | A gate that is not executed is indistinguishable from a gate that passes. Worse, it manufactures false confidence in a README. |
| Tests that assert on source text | majelishub `permissions.test.ts` | `source.includes("requirePermission(")` is not an authorization test. Behavioural assertions only. |

## Layering, as actually enforced

```
src/app         routes and pages. Thin: parse, authorize, delegate, render.
                MUST NOT import a Drizzle schema. MUST NOT determine identity.
src/features    business operations. Speaks domain types. Owns transactions.
src/domain      pure: types, state machines, invariants, policy. No I/O, no framework.
src/server      adapters: db, auth, storage, media, jobs, telemetry. Implements ports.
src/shared      contracts, validation, time, ui primitives. Bottom layer.
```

`majelishub` encodes this as a lint rule (`majelishub/module-boundaries`) and **8 of its own files
violate it**. `homeops` encodes it as `homeops/boundaries` and **4 of its own files violate it**. Both
rules are correct. The only defect is that neither runs in CI.

Consequence for the plan: fixing the 12 violations is cheap, high-value, and it is the cheapest way to
prove the gates work. `F-002`, `F-005` and `F-006` all touch these files, so the violations are
resolved as a side effect of the P0 fixes rather than as separate work.

## Error handling convention

`majelishub/src/shared/contracts/errors.ts` — `AppError` with a code, an HTTP status, and a
`toShape()` that carries no internal detail — is the best error model here. `permissions.test.ts`
asserts that a cross-organization error's serialised form does not contain the other tenant's id.

Adopt it. `homeops` and `siomayops` return ad-hoc `Response.json({error, code})` shapes with raw
exception messages in some paths; `homeops`'s room route surfaced a raw Drizzle error including the
SQL text and parameters in the response body during this audit.

## Testing architecture

| Layer | Contract | Reality today |
|---|---|---|
| unit | pure, no I/O | green in all four TypeScript projects |
| integration | real PostgreSQL, assert row counts not timings | **only** `majelishub` does this, and it cannot run as a batch (F-007) |
| browser | real DOM | not configured anywhere |
| e2e | Playwright, real journeys | 34 `spec` files exist; **zero** run; `siomayops`'s three are synthetic constants |

The single most valuable missing test class in the whole repository: **assert that an unauthenticated
request is refused.** Its absence is why three P0s reached `main`.

## Runtime configuration

- **Node 24** — `homeops` (`>=24`), `majelishub` (`>=24 <25`), `yomi` (`>=24 <25`). Node 22 satisfies
  the other two. `npm ci` on Node 22 produces `EBADENGINE` warnings and, in this audit, was not
  sufficient for the Next 16 builds.
- **PostgreSQL 18** — real server via `embedded-postgres` works and is fast enough for integration
  suites (`homeops`' integration tier skips because its harness cannot locate one; see `F-019`).
- **PGlite** — acceptable for *test speed* in unit scope. **Never** acceptable as the source of a
  completion claim about persistence, RLS, or a driver.

## The change architecture, in one paragraph

Nothing in this plan requires a new framework, a new database, or a new deployment model. Every P0 is
fixed by routing an existing code path through an existing helper that is already written and already
tested somewhere in this repository. The plan is deliberately *subtractive*: remove the header
identity, add the session check that `authorize.ts` was written for, add the RLS policies that
`0001_row_level_security.sql` documents, and put the twelve lint violations back inside the boundary.
