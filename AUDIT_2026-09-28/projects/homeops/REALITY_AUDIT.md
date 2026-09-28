# REALITY AUDIT — homeops-household-manager-spec

**Commit:** `8ebc15f` · **Audited:** 2026-09-28 · **Status: `MVP_BLOCKED`**

## 1. What the code actually is

A household manager with 32 real pages (zero `ROUTE SHELL`), 8 API routes, a PGlite/PostgreSQL dual
driver, a working scheduler, and 17 tables. The docs describe the pre-wave-2 repository.

| Document | Claim | Reality (measured) |
|---|---|---|
| `README.md:3` | "**implementation has not started**" | 32 pages render, 8 routes serve data |
| `README.md:3` | "**every page and component shell returns `null`**" | `grep -rl "return null" src/app` → 28 of 32 |
| `README.md:3` | "**every test is a declared todo**" | 8 files contain `expect(`; 37 of 45 are todo |
| `README.md:3` | "skeleton of 175 files (128 src, 44 tests, 3 tooling)" | 330 files: 169 src, 49 tests |
| `README.md:3` | "**252 tasks**" | 248 unique `T-XXX-NNN` ids in `TASKS.md` |
| `AGENTS.md:9` | "**No product feature is implemented**" | false |
| `AGENTS.md:15` | "**Forbidden:** Real SQL queries or table definitions" | 17 tables, repositories, 8 live routes |
| `AGENTS.md:18` | "**Forbidden:** Functional authentication" | `src/app/(auth)/` has sign-in, sign-up, reset, invite |
| `ROADMAP.md:3` | "**VS-1 NOT STARTED**" | rooms, chores, recurrence, activity, issues, trash, resources, maintenance, alerts all present |
| `SECURITY.md:12` P-1 | "**No unscoped query helper exists**" | see §4 |
| `SECURITY.md:12` P-2 | "Every operation checks the caller's membership + role server-side" | no route calls `authorize` |

`TASKS.md` contains **zero** `**Delivered:**` markers. The register has no status column at all, so
"nothing is marked done" is being read as "nothing was done" — the inverse of what happened.

## 2. Gate status (measured)

| Gate | Command | Exit | Note |
|---|---|---:|---|
| install | `npm ci` | 0 | |
| typecheck | `npm run typecheck` | 0 | |
| lint | `npm run lint` | **1** | **30 errors**, incl. `homeops/boundaries`: *"`app/**` must never import `server`"* in 4 routes |
| build | `npm run build` | 0 | |
| unit tests | `npm test` | 0 | 6 files passed / 11 skipped, **49 passed** |
| integration tests | `npm run test:integration` | 0 | **13 files / 15 tests, all SKIPPED** — the suite is inert without a server the harness will not find |

The project's own `homeops/boundaries` lint rule (which encodes `AGENTS.md` §4) is violated by the
wave-2 routes and was never run in CI. `.github/workflows/project-checks.yml` runs `lint` for `yomi`
only.

## 3. Persistence reality — the deploy path is broken

`migrations/` contains two files:

- `0000_identity_tenancy_platform.sql`
- `0001_rooms_chores.sql`

`migrations/meta/_journal.json` contains **one** entry (`0000`). `scripts/migrate.ts` calls drizzle's
migrator against that journal. Verified on real PostgreSQL 18.4:

```
$ npm run db:migrate
migrations applied to homeops_test in 2170 ms          # exit 0, claims success

$ psql -c '\dt'
… 14 tables, no `room`, no `chore_definition`, no `chore_occurrence`

$ curl localhost:3101/api/homeops/today?householdId=<uuid>
HTTP 500
  [cause]: relation "chore_occurrence" does not exist   (SQLSTATE 42P01)
```

**GAP-P0-HOM-03.** The exit code is 0 and the message says "applied", so no deploy gate would catch
this. The wave-2/3 evidence was produced on PGlite, where `scripts/seed-wave2-homeops.mjs` creates
those tables with raw SQL, so the broken deploy path was never exercised.

`migrations/meta/0000_snapshot.json` also exists while `0001` has no snapshot — the journal/snapshot
pair is inconsistent, which is why drizzle skips it.

## 4. Security reality

### GAP-P0-HOM-01 — cross-household read with no session (verified)

All four data routes resolve the tenant from caller-controlled input:

```
src/app/api/homeops/rooms/route.ts:7              req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId')
src/app/api/homeops/today/route.ts:7              (identical)
src/app/api/homeops/chores/route.ts:8 and :19     (identical, plus body.householdId)
src/app/api/homeops/chores/[id]/complete/route.ts:15  (three sources, first non-null wins)
```

`src/server/auth/authorize.ts` exists and throws `Error('Not implemented: T-AUTH-005')`.
`grep -rn "authorize" src/app/api` → **no results**. No route performs a membership check, a role
check, or a session lookup.

**Verified** on a production build against real PostgreSQL 18.4, with two households seeded
(`aaaa1111-…` = A, `bbbb2222-…` = B, each with a room):

```
GET /api/homeops/rooms?householdId=aaaa1111-…   (no cookie, no session, no header)
  → 200 {"householdId":"aaaa1111-…","rooms":[{"name":"Kamar Rahasia A", …}]}

GET /api/homeops/rooms?householdId=bbbb2222-…   (same request, other household's id)
  → 200 {"householdId":"bbbb2222-…","rooms":[{"name":"Kamar Rahasia B", …}]}
```

Raw capture: [`../evidence/homeops-crosshouse.txt`](../../evidence/homeops-crosshouse.txt).
Knowing a household UUID is sufficient. UUIDs are not secret: they appear in page markup, in the
`data/db.json`-style seeds, and in every log line.

### GAP-P0-HOM-02 — no row-level security at all

```
$ grep -il "row level security\|CREATE POLICY" migrations/*.sql      → no matches
$ select relname from pg_class where relkind='r' and relrowsecurity  → []
```

17 tables, 0 protected. `SECURITY.md` P-1 makes household isolation "the primary boundary" and cites
ADR-005. There is no database-level enforcement, and no application-level enforcement either (§4
above). Any query in the codebase is a potential cross-household read.

### Correct: session primitives exist

`src/app/(auth)/` has real sign-in, sign-up, reset, invite pages; `src/server/db/schema/auth.ts`
defines `session`, `account`, `verification`. The authentication *shell* is there — it is simply not
wired to the data routes. That makes this fix cheap: the pieces exist.

## 5. UI reality

32 pages render, but all wave-2 pages hardcode the household id client-side:

```tsx
// src/app/(household)/rooms/page.tsx:5
const HOUSEHOLD_ID = '594f4d49-3333-3333-3333-333333333333';
```

and send it as a header. Every page uses inline `style={{}}` literals; `DESIGN.md`/`ACCESSIBILITY.md`
are unsatisfied and no token layer or contrast gate exists in this project (`scripts/check-contrast.mjs`
exists but has never run green on these pages).

## 6. Tests that execute

| Layer | Command | Result |
|---|---|---|
| unit | `npm test` | 49 pass, 0 fail, 11 files skipped |
| integration | `npm run test:integration` | **15 tests, all skipped** — exit 0 with zero coverage |
| lint rules | `npm run lint` | 30 errors (this project's own `homeops/boundaries` rule) |

The "15 integration pass on real PG18" claim in `COMPLETION_MATRIX.md` cannot be reproduced: the
suite requires a server the harness does not locate, and skips rather than failing.

## 7. Core journeys

See [../USER_JOURNEYS.md](../../USER_JOURNEYS.md) UJ-HOM-001…005.

| Journey | Reality |
|---|---|
| UJ-HOM-001 sign in | pages exist, session rows writable; not wired to data routes |
| UJ-HOM-002 see today's chores | `500` on the deploy path; works only after the uncommitted 0001 migration |
| UJ-HOM-003 complete a chore | same, plus tenant id from a header |
| UJ-HOM-004 room list | works, cross-household |
| UJ-HOM-005 alert / trash / resources | pages render; no write path proven |

## 8. What is needed for a real user to do the core job safely

1. Register `0001` in the drizzle journal (or replace the journal mechanism) and add a boot-time
   schema-version check.
2. One session helper that every data route calls: cookie → session → household → role. Delete the
   header/query fallbacks.
3. RLS on all 17 tables keyed on `household_id`, with a per-transaction `set_config`.
4. Convert the 4 lint errors and rerun lint in CI.
5. Make the integration harness provision its own database instead of skipping.

## 9. Evidence IDs

| ID | command | result |
|---|---|---|
| EV-HOM-01 | `curl "localhost:3101/api/homeops/rooms?householdId=bbbb2222-…"` | `200`, household B's data |
| EV-HOM-02 | `select … from pg_class where relrowsecurity` | `[]` |
| EV-HOM-03 | `npm run db:migrate` then `curl /api/homeops/today` | exit 0, then `500 relation "chore_occurrence" does not exist` |
| EV-HOM-04 | `npm run lint` | exit 1, 30 errors |
| EV-HOM-05 | `npm run test:integration` | 15 tests, all skipped |
| EV-HOM-06 | `cat migrations/meta/_journal.json` | 1 entry, `0001` absent |
