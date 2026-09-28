# REAL AUDIT SUMMARY

**Date:** 2026-09-28 · **Base commit:** `8ebc15fd68acc6e32046886a10156f73cf9ed2d5` (branch `main`)
**Branch:** `feat/hapus_kebohongan_document` (audit branch, no production code modified)
**Scope:** 7 of 8 projects. `yomi-manga-reader-arch-skeleton` **excluded** (concurrent work by another
agent; not inspected, not modified).

## How this document was produced

Nothing in this audit is taken from a README, a TASKS.md status column, a screenshot, a commit
message, a completion matrix, or a test count written in prose. Every row below was produced by:

1. `npm ci` / `npm install`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — actual
   runner exit codes in [TEST_EXECUTION.md](TEST_EXECUTION.md).
2. A real **PostgreSQL 18.4** server started from `embedded-postgres` (not PGlite, not a mock) so that
   PGlite-specific behaviour could not be mistaken for database behaviour.
3. Each app started in **production mode** (`node .next/standalone/server.js` / `next start`,
   `NODE_ENV=production`) and probed with `curl` **without any cookie or credential**.
4. Direct SQL executed against the running database to establish what the database layer actually
   enforces.

Raw probes are in [`evidence/`](evidence/). Full per-project detail is in
[`projects/`](projects/).

## Status criteria (used throughout, no percentages)

| Status | Criterion (all must hold) |
|---|---|
| `UNUSABLE` | No actor can complete the product's core job. |
| `DEMO_ONLY` | Core job completable only with a hardcoded identity, in-memory state, or a mock, and the state is lost on restart. |
| `MVP_BLOCKED` | Core job completable by a real user, but a P0 security/data-loss defect makes normal use unsafe. |
| `MVP_PARTIAL` | Core job completable and safe, but the journey is operationally incomplete. |
| `MVP_USABLE` | Every core job in [USER_JOURNEYS.md](USER_JOURNEYS.md) completes, safely, with durable state. |
| `PRODUCTION_CANDIDATE` | `MVP_USABLE` + no P0 + no P1 on the core journeys + gates green on real PostgreSQL. |

No status is derived from a task count, a test count, or a task-register percentage.

## Scoreboard

| Project | Core journeys | Working | Partial | Blocked | P0 | P1 | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| `siomayops-streetfood-stall-ops-spec` | 6 | 1 | 4 | 1 | 2 | 3 | `MVP_BLOCKED` |
| `homeops-household-manager-spec` | 5 | 0 | 3 | 2 | 3 | 2 | `MVP_BLOCKED` |
| `majelishub-pengajian-event-platform-spec` | 6 | 0 | 2 | 4 | 3 | 3 | `MVP_BLOCKED` |
| `strangerlink-random-chat-webrtc-spec` | 4 | 2 | 2 | 0 | 0 | 2 | `DEMO_ONLY` |
| `manga-reader-spec-skeleton-minimal` | 4 | 1 | 2 | 1 | 1 | 2 | `MVP_BLOCKED` |
| `parking-attendant-ops-app-spec` | 4 | 2 | 2 | 0 | 0 | 1 | `DEMO_ONLY` |
| `rsi-agent-recursive-self-improvement-prototype` | 2 | 2 | 0 | 0 | 0 | 0 | `MVP_USABLE` (as a declared offline prototype) |

Read the "Working / Partial / Blocked" columns as *core journeys*, not features. A project with 37
working API routes and 0 working core journeys is `MVP_BLOCKED`.

## The five findings that dominate everything else

### F1 — Unauthenticated write on a production build (siomayops)

`src/server/auth/port.ts:46` guards the fake auth provider with a condition that only fires when the
opt-in flag is **on**:

```ts
if (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_AUTH === "true") throw …
const role = (process.env.FAKE_AUTH_ROLE as Role) || "HQ_OPS";
```

In production with the flag unset — the normal case — no error is thrown and every caller receives a
full `HQ_OPS` session. Verified against a production build:

```
GET  /api/v1/sales     (no cookie)          → 200
GET  /api/v1/audit     (no cookie)          → 200  (returns audit rows)
POST /api/v1/incidents (no cookie, no key)  → 201  {"incidentId":"…","status":"REPORTED"}
```

`IMPLEMENTATION_STATUS.md:16` describes this as *"auth port (fake guarded, no production default)"*.
The code does the opposite. **GAP-P0-SIO-01.**

### F2 — Cross-household read with no session (homeops)

`SECURITY.md:12` P-1 states *"Every scoped read/write goes through a port requiring
`HouseholdContext` … No unscoped query helper exists."* In production, against real PostgreSQL 18.4:

```
GET /api/homeops/rooms?householdId=<ANY household uuid>   (no cookie, no session)
  → 200 {"householdId":"…","rooms":[{"name":"Kamar Rahasia B", …}]}
```

Identity comes from `req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId')` in
all four data routes. `src/server/auth/authorize.ts` exists, throws `Not implemented: T-AUTH-005`, and
is imported by **zero** routes. **GAP-P0-HOM-01.**

### F3 — Identity supplied by a request header (majelishub)

Two API routes resolve the caller as
`request.headers.get("x-majelishub-user") || url.searchParams.get("userId") || "majelishub-jakarta-admin"`.
Verified on a production build against real PostgreSQL 18.4:

```
POST …/organizations/<org>/events   no header              → 404  (correctly rejected)
POST …/organizations/<org>/events   x-majelishub-user: organizer-1  → passed authentication
                                                                   and the event.write permission check
                                                                   (reached the audit-chain write)
```

The static gate in `tests/integration/security/permissions.test.ts` passes these routes because it
only asserts the substring `requirePermission(` is present. **GAP-P0-MAJ-01.**

### F4 — Zero row-level security in the project whose spec makes RLS the primary boundary (homeops)

`grep -il "row level security\|CREATE POLICY" migrations/*.sql` → **no matches.** Querying
`pg_class` after applying every migration on a real PostgreSQL 18.4:

```
RLS-enabled tables: []
```

17 tables exist, none protected. `SECURITY.md` P-1 and ADR-005 describe household isolation as the
primary boundary; there is no database-level enforcement of it at all. **GAP-P0-HOM-02.**

### F5 — A migration that the deploy pipeline silently skips (homeops)

`migrations/0001_rooms_chores.sql` exists but `migrations/meta/_journal.json` contains one entry, for
`0000`. `scripts/migrate.ts` uses drizzle's migrator, which reads the journal. So the deploy path
creates 14 tables and **never** creates `room`, `chore_definition`, or `chore_occurrence`. Verified on
real PostgreSQL 18.4 with the committed migration runner:

```
$ npm run db:migrate   →  "migrations applied to homeops_test in 2170 ms"   (exit 0)
$ GET /api/homeops/today   →  500  [cause]: relation "chore_occurrence" does not exist
```

The wave2/wave3 evidence (`RUNNABLE_DEMO`, six screenshots) was produced against PGlite, where the
seed script creates those tables with raw SQL. **GAP-P0-HOM-03.**

## Documentation that this audit overturns

Full list in [DOCUMENTATION_RECONCILIATION.md](DOCUMENTATION_RECONCILIATION.md). The load-bearing ones:

| Document | Claim | Verified reality |
|---|---|---|
| `majelishub/README.md:41` | `npm run verify:vs0` is a gate | no such script in `package.json` |
| `majelishub/README.md:41` | `npm run lint` → exit 0 | exit 1, 8 errors, all `majelishub/module-boundaries` |
| `majelishub/README.md:30` | 125 passing (10 integration suites on real PostgreSQL 18) | 67 pass / 58 skip / 281 todo on PGlite; on real PG per-suite 52 pass + 1 real failure; as a batch the suite cannot run at all (F7) |
| `homeops/README.md:3` | "implementation has not started", "every page returns null", "every test is a todo", 175 files, 252 tasks | 32 real pages, 0 shells, 8 test files with assertions, 330 files, 248 task ids |
| `homeops/SECURITY.md:12` | P-1 no unscoped helper; P-2 server-side membership check | F2, F4 |
| `siomayops/README.md:14` | "no working product", no auth, no loyalty/settlement/stock/dashboard | 37 routes, 13 pages, 0 `Not implemented`, loyalty + settlement + stock + dashboard all present |
| `siomayops/SECURITY.md:4` | "no auth, no crypto, no hardening implemented" | full `ROLE_PERMISSIONS` matrix for 8 roles; F1 |
| `strangerlink/README.md:205` | "NOT DEPLOYABLE. No random-chat feature is implemented." | in-repo `README_IMPLEMENTATION.md`: "All 33 tasks DONE"; matchmaking, reports, realtime server, 85 passing tests all real |
| `strangerlink/README.md:183` | "every test file contains only describe.todo" | 10/10 test files contain real assertions |
| `parking/MVP_AUDIT/.../AFTER.md:12` | `python3 server.py --port 3201`, 8 screenshots as proof | no `server.py` and no `static/` in any branch of any commit; `NON_REPRODUCIBLE_EVIDENCE` |
| `manga/ROADMAP.md:3` | "No slice is executed in this phase" | VS-1/VS-2 running; `/admin` returns 200 unauthenticated |
| `rsi/README.md:48` | 141 tests | 147 executed |

## Corrections to this audit

`ADR-003` says documentation is a claim until a command settles it. That rule applies to the audit
too, and one of my own findings did not survive its own test.

| Claim I made | Correction | How it was caught |
|---|---|---|
| `majelishub/README.md:35` ("the lint rule checks all 53" stub ids) is **FALSE** — "53 does not match either count" | **The README is correct.** 53 unique `T-XXX-NNN` ids appear in `Not implemented:` across `src/`, at 80 throw sites; 52 of the 53 are thrown, one appears only in a `TODO(...)` marker. My draft measured only the ids appearing *inside throw statements* and concluded the claim was overstated. | A re-measurement of every cited number against the tree, after the audit documents were written. The count is right for the quantity the README actually names. |

A second apparent discrepancy was **not** an error in the documents: `grep -rl "ROUTE SHELL" src/app`
returns 66 files, but 22 of those are API route files whose doc comment contains the same phrase.
Measured against `page.tsx` only — the thing the README is counting — it is 44 shells and 5 real
pages, which is what the audit states.

**Neither correction changes any status, gap, priority, or recommendation.** They are recorded here
because a plan that quietly fixes its own errors is worth less than one that publishes them.

## What is genuinely good, and should be preserved

Not everything here is bad. These are the assets a follow-up agent should not break:

- **siomayops** is the only project whose `typecheck`, `lint`, `build`, `check:docs` and `npm test`
  are all green on a clean install. Its payment webhook verifier is correct: HMAC-SHA256,
  `timingSafeEqual`, fail-closed on missing secret or non-hex signature
  (`src/server/payments/webhook-verifier.ts:27-43`). Its design intent is the strongest in the repo.
- **rsi-agent** is the only project whose deliverable register (`DELIVERABLES.md`) explicitly
  disclaims what it does *not* certify. That is the documentation standard the other six should meet.
- **majelishub** has the only genuinely enforced database layer in the workspace. RLS works — proven
  on real PostgreSQL 18.4 (see [SECURITY_GAPS.md](SECURITY_GAPS.md) §2, test 3). The problem is that
  four public pages bypass it, not that it does not exist.
- **parking**'s `README.md` §"Completion boundary" is a model of honest scoping.
- **strangerlink** is a real, working, tested product loop; it is only ephemeral.

## Falsifiable claims this audit makes, with the command that settles each

| # | Claim | Settle it with |
|---|---|---|
| C1 | siomayops accepts unauthenticated writes in production | `siomayops && npm start` then `curl -X POST localhost:3200/api/v1/incidents` |
| C2 | homeops serves any household's data without a session | `curl "localhost:3101/api/homeops/rooms?householdId=<uuid>"` |
| C3 | homeops has no RLS | `select relname from pg_class where relkind='r' and relrowsecurity` |
| C4 | homeops' deploy migration omits rooms/chores | `npm run db:migrate` then `\dt` |
| C5 | majelishub accepts a header-supplied identity | `curl -H 'x-majelishub-user: <id>' -X POST …/events` |
| C6 | majelishub public pages leak cross-tenant | `GET /kajian` with two seeded organizations |
| C7 | majelishub lint is red | `npm run lint` in majelishub → 8 errors |
| C8 | majelishub integration suite cannot run as a batch on real PG | `INTEGRATION_DATABASE_URL=… npx vitest run --project integration` |
| C9 | manga `/admin` is public | `curl -i localhost:3110/admin` → 200, "Admin Portal" |
| C10 | strangerlink has no persistence | `find strangerlink… -name '*.sql'` → nothing |
| C11 | parking evidence references non-existent code | `git log --all --diff-filter=A -- '*server.py'` → empty |
| C12 | siomayops' own stub gate is red | `npm run check:stubs` → exit 1 |

## Where to start

1. Fix **F1** (siomayops fake auth). One condition, one file, one test. Nothing else in this workspace
   is more valuable per line changed.
2. Fix **F2 + F4 + F5** (homeops). They are one coherent unit: a real session, a real tenant predicate,
   a real RLS migration, and a journal entry. Until then the product cannot be shown to anyone.
3. Fix **F3 + F6 + F7** (majelishub): remove header identity, route the four public pages through the
   scoped repository, add schema-per-suite isolation to the harness.
4. Then **[IMPLEMENTATION_ORDER.md](../specs/execution/IMPLEMENTATION_ORDER.md)** waves 1–2, which is where
   the actual product gets built.
