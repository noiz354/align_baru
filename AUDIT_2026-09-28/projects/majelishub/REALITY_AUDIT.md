# REALITY AUDIT — majelishub-pengajian-event-platform-spec

**Commit:** `8ebc15f` · **Audited:** 2026-09-28 · **Status: `MVP_BLOCKED`**

This is the most thoroughly specified project in the workspace (102 markdown files, 30 API routes, 49
pages, 6 migrations, 3 custom lint rules, a VS-0 gate script). It is also the one where the
documentation most precisely describes a system that no longer matches the code.

## 1. Documentation vs. measured reality

| Claim | Source | Measured |
|---|---|---|
| `npm run verify:vs0` is a gate | `README.md:41`, `TASKS.md:127` | **no such script in `package.json`.** `ops/verify-vs0.mjs` exists but is unreachable via the documented command |
| `npm run lint` → exit 0 | `README.md:41` | **exit 1, 8 errors**, all `majelishub/module-boundaries`: *"`app/**` may not import `@/server/db/schema`"* — in `kajian/page.tsx`, `masjid/page.tsx`, `kajian/[slug]`, `masjid/[slug]`, `checkin/validate`, `checkin/summary`, `registrations` |
| "49 page shells + 26 API route shells" | `README.md:27`, `:55` | 49 pages, of which **44 are `ROUTE SHELL` and 5 are real**; **30** API routes |
| "four reviewed SQL migrations" | `README.md:29` | **six** (`0000`–`0005`); `0004`/`0005` undocumented |
| "the lint rule checks all 53" stub ids | `README.md:35` | **VERIFIED CORRECT.** 53 unique `T-XXX-NNN` ids appear in `Not implemented:` across `src/`, at 80 throw sites; 52 of the 53 are thrown, one appears only in a `TODO(...)` marker. An earlier draft of this audit recorded the claim as false — that was the error. |
| "125 passing (10 integration suites on a real PostgreSQL 18)" | `README.md:30` | see §3 — 67 pass / 58 skip / 281 todo on PGlite; on real PG per-suite 52 pass + **1 real failure**; as a batch the integration project **cannot run at all** |
| "exactly ten tasks are implemented" | `README.md:12` | wave2/wave3 added `T-ORG-002`, `T-MOSQUE-001`, `T-EVENT-003`, `T-REG-001`, `T-CHECKIN-001` code; `TASKS.md` still lists them `Planned` |
| "Still prohibited everywhere: … production UI" | `README.md:12` | `src/app/dasbor/majelishub-client.tsx` is a production UI with a user picker, a create form, and a green "RLS proof" panel |
| "13-step flow ACHIEVED" | `MVP_AUDIT/progress/…/AFTER.md:3` | step 2 calls `GET /api/majelishub/organizations`, which now requires a session; under PGlite `getSession()` always returns `null` → `401`; the client swallows it with `j.organizations ?? []`. Verified `401`. The seven "after" screenshots depict a state that no longer exists |

`AGENTS.md`, `TASKS.md` and `README.md` disagree with each other, and `MVP_AUDIT/wave3/…/RUNTIME_PROOF.md`
(which correctly reports the `401`s) was never reconciled against `AFTER.md`.

## 2. Gate status (measured)

| Gate | Command | Exit | Note |
|---|---|---:|---|
| install | `npm ci` | 0 | |
| typecheck | `npm run typecheck` | 0 | |
| lint | `npm run lint` | **1** | 8 errors, all the project's own `module-boundaries` rule |
| build | `npm run build` | 0 | |
| test (default = PGlite) | `npm test` | **1** | 9 files fail on hook timeout; **67 passed, 58 skipped, 281 todo** of 406 |
| integration, real PG 18.4, as a batch | `INTEGRATION_DATABASE_URL=… npx vitest run --project integration` | **1** | 6 files fail: `relation "users" already exists` |
| integration, real PG 18.4, one suite at a time | same, with `DROP SCHEMA public CASCADE` between suites | 0 / 1 | 8 suites pass (**52 tests**); `audit/coverage` **1 failed**; 46 suites are pure `todo` |

## 3. The two test-harness findings

### GAP-P1-MAJ-04 — the integration project cannot run as a batch on real PostgreSQL

Every suite calls `createTestDatabase()`, which applies every file in `drizzle/`. There is no
schema-per-suite isolation, so the second suite collides with the first. `tests/support/db.ts` names
this as future work: *"the full harness — containers, **isolated schema per suite**, seed generator —
is `T-TEST-001`"*. `T-TEST-001` is not delivered. Consequence: **the "10 integration suites on a real
PostgreSQL 18" claim is not reproducible**, and CI never runs a database at all for this project.

### GAP-P1-MAJ-05 — a real assertion that PGlite hides

`tests/integration/audit/chain.test.ts` asserts `chain_position` is a number. On PGlite it is; on
`node-postgres` an `int`/`bigint`-shaped column comes back as a **string**, and the suite fails:

```
AssertionError: expected [ '1', '2', '3', '4', '5', '6', …(4) ] to deeply equal [ 1, 2, …, 10 ]
```

The PGlite-only default in CI concealed a driver divergence in the audit chain — the one subsystem
whose correctness the product's trust story depends on.

## 4. Security reality

### GAP-P0-MAJ-01 — identity supplied by a header (verified)

`src/app/api/majelishub/organizations/[orgId]/events/route.ts` (GET and POST) and
`src/app/api/majelishub/organizations/[orgId]/events/[eventId]/route.ts` (GET):

```ts
const userId = request.headers.get("x-majelishub-user")
            || url.searchParams.get("userId")
            || "majelishub-jakarta-admin";
```

**Verified** on a production build against real PostgreSQL 18.4, with an `ORGANIZER` membership
seeded for user id `organizer-1`:

```
POST …/organizations/<org>/events   (no header)                        → 404  (rejected)
POST …/organizations/<org>/events   x-majelishub-user: organizer-1    → passed authentication
                                                                   and the event.write permission check;
                                                                   reached the audit-chain write
```

Raw capture: [`../evidence/majelishub-spoof.txt`](../../evidence/majelishub-spoof.txt).
Knowing a user id is sufficient to act as that user. `MVP_AUDIT/wave3/…/IMPLEMENTATION.md` claims
these routes were hardened; only `/organizations` and `/mosques` were.

**Why the gate missed it:** `tests/integration/security/permissions.test.ts` classifies a route as
protected by `source.includes("requirePermission(")`. A string-presence test is not an authorization
test. That is precisely the pattern this audit was told to reject.

The write then failed with `500` inside the audit chain (`audit_events` column mismatch surfaced by
the `SELECT … FOR UPDATE` in `src/server/audit/writer.ts`), so the event was not committed — the
bypass reaches the write path, and a second defect stops it there. Fixing the 500 without fixing the
header would turn this from a 500 into a silent unauthorized write.

### Correct and genuinely strong: the database layer

RLS is real. Verified directly on PostgreSQL 18.4 with two organizations and two `PUBLISHED` events,
`SET LOCAL ROLE majelishub_app` inside a transaction:

| # | Query | Result |
|---|---|---|
| 1 | `SELECT … FROM kajian_events` as the **table owner**, no scope | **both** tenants' rows — no isolation, no status filter |
| 2 | same query as `majelishub_app`, **no `app.organization_id` set** | **0 rows** — RLS fails closed |
| 3 | same query, `app.organization_id` = Org A | **only Org A's row** — layer 3 genuinely works |

So `majelishub` is the only project in the workspace with a working database-enforced tenant boundary.
The defect is that four public pages never enter the scoped transaction, which makes them
simultaneously leaky (owner connection, as in dev) and empty (app-role connection, as in production).
Both outcomes are wrong.

### GAP-P0-MAJ-02 — public pages read tenant data with no scope and no status filter

`src/app/kajian/page.tsx`, `masjid/page.tsx`, `kajian/[slug]/page.tsx`, `masjid/[slug]/page.tsx` call
`getDb()` and `db.select()` directly: no `TenantScope`, no `rlsStatements`, no `requirePermission`,
no `status` predicate, no `isPublished` check. `kajian/[slug]` resolves by slug alone, but the unique
index is `(organization_id, slug)` — two organizations may own the same slug, and the page returns
whichever the planner yields. Its comment claims *"org-scoped via join"*; there is no join.

**Verified** on a production build: `GET /kajian` returned both `Kajian Org A` and `Kajian Org B`.

### GAP-P0-MAJ-03 — `catch { events = [] }` converts a database error into "0 event(s)"

The exact fake-success pattern `AGENTS.md §4.1` forbids, and the pattern the project's own
`no-fake-implementation` rule does not cover (it only catches a constant `{ success: true }` return).

## 5. Correct: the security machinery that does work

- `src/server/auth/permissions.ts` — a 9-role × 53-permission matrix walked cell-by-cell in
  `tests/integration/security/permissions.test.ts` (6 tests, passes on real PG), including
  self-approval refusal, non-delegable roles, reason-required permissions, and cross-org → `NOT_FOUND`.
- `src/server/audit/writer.ts` — hash-chained append-only audit with a per-organization advisory lock
  and `chain_position` uniqueness; `tests/integration/audit/chain.test.ts` passes on real PG.
- `src/server/auth/session.ts` — fails closed under PGlite rather than trusting a caller identity.
- `src/shared/observability/**` + `ops/eslint/no-token-logging.mjs` — one ban list enforced at
  runtime and at lint, with a unit-tested rule.

These are assets. The gaps are at the edges, not in the core.

## 6. Registration / check-in reality

- `POST /api/v1/events/[eventId]/registrations` — real, public by design, listed in `PUBLIC_ROUTES`
  with a rationale. Returns `accessToken: result.token` **and** `qrPayload: result.token`, i.e. the raw
  capability twice, which contradicts `T-CHECKIN-003`.
- On a duplicate email it returns `shortCode: existing.shortCode` — **another person's** short code.
  `POST /api/v1/checkin/validate` accepts a short code as an alternative credential, so registering
  with a victim's email yields the ability to check the victim in. **GAP-P0-MAJ-06.**
- `POST /api/v1/checkin/validate` — real, session-gated, membership + `checkin.validate` checked,
  tenant- and event-matched, idempotent via a unique index on `registration_id`.
- **Neither route has a single test.** No test file imports either route. The 281 todos include
  `checkin/validation.test.ts` and `registration/capacity-race.test.ts`, which are exactly the
  acceptance checklists for the two routes that were written.

## 7. Persistence reality

`REAL_DATABASE` on real PostgreSQL 18.4. Six reviewed SQL migrations, an explicit `db:migrate` runner
that never runs at boot, checksum bookkeeping, and RLS policies on `organizations`,
`organization_members`, `mosques`, `kajian_events`. **The only project where I could not find a way to
lose business state on restart.**

Two caveats: `event_registrations` and `event_attendance` (`drizzle/0005_registrations.sql`) have **no
RLS enabled and no policy**, which contradicts the rule stated in `drizzle/0001`: *"Every tenant
aggregate added later MUST be added here in the same migration that creates it — the isolation suite
enumerates scoped tables and fails the build when one has no policy."* The suite does not enumerate.

## 8. Core journeys

See [../USER_JOURNEYS.md](../../USER_JOURNEYS.md) UJ-MAJ-001…006. None completes today.

## 9. Evidence IDs

| ID | command | result |
|---|---|---|
| EV-MAJ-01 | `npm run lint` | exit 1, 8 `module-boundaries` errors |
| EV-MAJ-02 | `npm test` | 67 pass / 58 skip / 281 todo, 9 files fail |
| EV-MAJ-03 | `INTEGRATION_DATABASE_URL=… npx vitest run --project integration` | 6 files fail, `relation "users" already exists` |
| EV-MAJ-04 | per-suite against real PG with schema reset | 52 pass; `audit/coverage` 1 failure (int-as-string) |
| EV-MAJ-05 | `curl -H 'x-majelishub-user: …' -X POST …/events` | passes authn + authz |
| EV-MAJ-06 | `GET /kajian` with 2 seeded orgs | renders both orgs' events |
| EV-MAJ-07 | `SET LOCAL ROLE majelishub_app; SELECT …` (no scope / scoped) | `[]` / Org A only |
| EV-MAJ-08 | `grep verify package.json` | no `verify:vs0` script |
