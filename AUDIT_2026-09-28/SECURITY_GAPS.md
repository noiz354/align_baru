# SECURITY GAPS

Every item below points to running code or a captured request. No item is based on a comment, a
document, or a test that searches source text.

**A note on the existing gates**, because it is the root cause of most of these:

`majelishub/tests/integration/security/permissions.test.ts` decides a route is protected with
`source.includes("requirePermission(")`. That is a string search, not an authorization test. It passes
two routes that authenticate the caller from `x-majelishub-user`. No other project has a behavioural
authorization test at all. The workspace currently has **no test anywhere that asserts an
unauthenticated request is refused** — which is exactly why three separate auth defects reached
`main`.

---

## GAP-P0-SIO-01 — Unauthenticated write on a production build (siomayops)

**Class:** authentication bypass → arbitrary business record creation
**Code:** `src/server/auth/port.ts:44-52`
**Root cause:** inverted guard condition.

```ts
if (process.env.NODE_ENV === "production" && process.env.ALLOW_FAKE_AUTH === "true") throw …
const role = (process.env.FAKE_AUTH_ROLE as Role) || "HQ_OPS";
```

The guard fires only when the *opt-in* flag is on. The production default (flag unset) returns a
privileged `HQ_OPS` session to every caller. `resolveSession()` has 78 call sites; the
`if (!session) return 401` branch is unreachable.

**Verified** (commit `8ebc15f`, `NODE_ENV=production`, `npm start`):

```
GET  /api/v1/sales?limit=5                     (no cookie)  → 200
GET  /api/v1/audit?limit=3                     (no cookie)  → 200, returns audit rows
POST /api/v1/incidents  (no cookie, no key)                 → 201 {"incidentId":"c92872d7-…"}
```

The created row lands in the audit chain as `actorId: 00000000-0000-7000-0000-000000000002`.
Capture: [`evidence/siomayops-unauth.txt`](evidence/siomayops-unauth.txt).

**Fix:** invert the condition and fail closed. One line, one file.
**Regression test:** for every mutating route, assert `401` with no cookie and no session.

---

## GAP-P0-HOM-01 — Cross-household read/write with no session (homeops)

**Class:** broken tenant isolation / IDOR
**Code:** `rooms/route.ts:7`, `today/route.ts:7`, `chores/route.ts:8,19`,
`chores/[id]/complete/route.ts:15` — all read
`req.headers.get('x-homeops-household') ?? url.searchParams.get('householdId')`.
`src/server/auth/authorize.ts` throws `Not implemented: T-AUTH-005` and has **zero** importers.

**Verified** (production build, real PostgreSQL 18.4, two households seeded):

```
GET /api/homeops/rooms?householdId=bbbb2222-…   (no cookie, no session, no header)
  → 200 {"rooms":[{"name":"Kamar Rahasia B", …}]}
```

Capture: [`evidence/homeops-crosshouse.txt`](evidence/homeops-crosshouse.txt).
Household UUIDs are not secret — they appear in page markup and logs.

**Fix:** one `requireHousehold(request)` helper every route calls; delete the header/query fallbacks;
derive the household from the session only.
**Regression test:** AC in `specs/features/F-002-tenant-context/ACCEPTANCE.md`.

---

## GAP-P0-HOM-02 — No row-level security anywhere (homeops)

**Class:** missing defence in depth for tenant isolation
**Evidence:** `grep -il "row level security\|CREATE POLICY" migrations/*.sql` → no matches;
`select relname from pg_class where relkind='r' and relrowsecurity` → `[]` after applying every
migration. 17 tables, 0 protected.

`SECURITY.md:12` P-1 makes household isolation the primary boundary and cites ADR-005. Neither the
database nor the application enforces it (§GAP-P0-HOM-01).

**Fix:** RLS keyed on `household_id` with a per-transaction `set_config`, mirroring the pattern
`majelishub` has already proven on real PostgreSQL (see below).

---

## GAP-P0-HOM-03 — Deploy migration silently omits the core domain tables (homeops)

**Class:** availability / data integrity
**Evidence:** `migrations/meta/_journal.json` contains one entry (`0000`).
`migrations/0001_rooms_chores.sql` is not registered, so drizzle's migrator skips it.
`npm run db:migrate` reports success (exit 0) and 14 tables are created:

```
$ curl localhost:3101/api/homeops/today?householdId=…
HTTP 500  [cause]: relation "chore_occurrence" does not exist  (42P01)
```

**Fix:** register the migration (or drop the journal mechanism), and add a boot-time schema-version
check that refuses to serve traffic when the code is ahead of the schema.

---

## GAP-P0-MAJ-01 — Identity supplied by a request header (majelishub)

**Class:** authentication bypass / impersonation
**Code:** `src/app/api/majelishub/organizations/[orgId]/events/route.ts` (GET, POST) and
`…/events/[eventId]/route.ts` (GET):

```ts
const userId = request.headers.get("x-majelishub-user")
            || url.searchParams.get("userId")
            || "majelishub-jakarta-admin";
```

**Verified** (production build, real PostgreSQL 18.4, an `ORGANIZER` membership seeded for
`organizer-1`):

```
POST …/organizations/<org>/events   no header                     → 404   (correctly refused)
POST …/organizations/<org>/events   x-majelishub-user: organizer-1 → passed authn + event.write authz
```

Capture: [`evidence/majelishub-spoof.txt`](evidence/majelishub-spoof.txt).
The write then hit a `500` in the audit chain (`SELECT … FOR UPDATE` against a column mismatch). That
is a second, separate defect — and it is currently the only thing stopping the bypass from becoming a
silent write. **Fixing the 500 without fixing the header makes things worse.**

**Why the gate passed it:** `permissions.test.ts` classifies the route as protected because the
substring `requirePermission(` is present.
**Fix:** delete the header/query branches; use `getSession()` as the sibling routes do.

---

## GAP-P0-MAJ-02 — Public pages read tenant data with no scope (majelishub)

**Class:** cross-tenant disclosure / availability
**Code:** `src/app/kajian/page.tsx`, `masjid/page.tsx`, `kajian/[slug]/page.tsx`,
`masjid/[slug]/page.tsx` call `getDb()` and select directly — no `TenantScope`, no
`rlsStatements`, no `requirePermission`, no `status`/`isPublished` filter. `kajian/[slug]` resolves
by slug, but the unique index is `(organization_id, slug)`.

Measured behaviour of that exact query against real PostgreSQL 18.4, as the RLS-enforced app role:

| Scenario | Result |
|---|---|
| owner connection, no scope (dev/local) | **both** tenants' rows — cross-tenant leak |
| app-role connection, no scope (production) | **0 rows** — page renders "0 event(s)" |
| app-role connection, scope set | Org A only — correct |

**Verified** end to end: `GET /kajian` on a production build rendered `Kajian Org A` *and*
`Kajian Org B`.
Both configurations are wrong; the page is neither safe nor functional.

**Fix:** route the four pages through `listEvents`/`findEventBySlug`/`findMosqueBySlug` with an
explicit public scope, and add `status = 'PUBLISHED'`.

---

## GAP-P0-MAJ-03 — Database error rendered as "no data" (majelishub)

**Class:** correctness / trust
**Code:** `catch { events = [] }` in `kajian/page.tsx` and `masjid/page.tsx`.
A failed query is indistinguishable from an empty catalogue. The product's own
`AGENTS.md §4.1` and `DESIGN.md` mandate honest loading/empty/error states; its own
`majelishub/no-fake-implementation` rule does not cover this shape.

---

## GAP-P0-MAJ-06 — Duplicate registration discloses another attendee's check-in code

**Class:** capability disclosure
**Code:** `src/app/api/v1/events/[eventId]/registrations/route.ts` — on a duplicate email it returns
`shortCode: existing.shortCode`.
`POST /api/v1/checkin/validate` accepts a short code as an alternative to a token.
An unauthenticated caller who knows a victim's email can obtain a working check-in credential for
them. The same handler also returns `accessToken: result.token` **and** `qrPayload: result.token` —
the raw capability twice — which contradicts `T-CHECKIN-003`.

Neither route has any test.

**Fix:** on duplicate, return `ALREADY_REGISTERED` with no secret. The attendee retrieves their own
code through an authenticated, token-bearing request.

---

## GAP-P0-MAN-01 — Unauthenticated admin surface (manga)

**Class:** missing authorization boundary
**Verified:** production build, `GET /admin` and `GET /admin/manga` → `200`, body contains
"Admin Portal" / "Catalog Management". `grep -rln "auth\|session\|role" src/app/admin/` matches one
file, and only on the word "role" in copy.

**Current blast radius:** an unauthenticated view of editorial structure. There is no admin mutation
route yet (`find src/app -path '*admin*' -name route.ts` → nothing), so nothing can be changed.
**Why it is P0 anyway:** the boundary must exist *before* the first admin write lands, not after. Build
it now; the cost is one `getSessionUser` + role check per page.

---

## GAP-P0-MAJ-04 — Audit tables outside the RLS contract (majelishub)

`drizzle/0001_row_level_security.sql` states: *"Every tenant aggregate added later MUST be added here
in the same migration that creates it — the isolation suite enumerates scoped tables and fails the
build when one has no policy."*
`drizzle/0005_registrations.sql` creates `event_registrations` and `event_attendance` with **no
`ENABLE ROW LEVEL SECURITY` and no policy**, and the isolation suite does not enumerate anything.

**Fix:** add policies in `0005`; make the suite enumerate `pg_class` and fail on an unprotected tenant
table.

---

## GAP-P1-SIO-02 — Idempotency is opt-in on money routes (siomayops)

`src/app/api/v1/_helpers.ts:47-56`: when `Idempotency-Key` is absent the handler executes the mutation
anyway. `T-SALE-001` and ADR-0015 require it on money operations. On a flaky connection a retry
double-charges.
**Fix:** return `400 IDEMPOTENCY_KEY_REQUIRED` on mutating routes when the header is absent.

## GAP-P1-SLK-01 — Safety records are not durable (strangerlink)

`banStore`, `reportStore`, `moderationStore`, `safetyEventStore` are process-global `Map`s in
`src/server/db/in-memory.ts`. A restart or deploy un-bans every identity and discards every report.
For a product whose own `SAFETY.md` names safety as the first non-negotiable, this is the gap that
matters.
**Fix:** durable store for safety records only. Keep queue/session/message buffers ephemeral —
that part is already correct.

## GAP-P1-SLK-02 — Lint gate unrunnable (strangerlink, and six projects downstream)

`package.json:15` declares `"lint": "eslint ."`, `eslint` is in neither dependency list, `npm run lint`
exits `127`. `.github/workflows/project-checks.yml` then disabled `lint` for the **entire** matrix
because of this one project. Six projects now have no static gate.
**Fix:** add `eslint` to strangerlink's devDependencies, re-enable `npm run lint` per project in CI
(individually, so one project cannot disable another's gate).

## GAP-P1-MAN-02 — Two test runners, one file never executed (manga)

`npm test` uses `node --experimental-strip-types --test` on two files.
`tests/integration/progress.test.ts` imports from `vitest` and is never run. `vitest ^3.1.1` is
declared and used by nothing that runs. The wave-3 "durable progress" evidence has no executing test.
**Fix:** one runner, and make the progress suite part of the default command.

## GAP-P1-HOM-04 — Integrations skipped, not failed (homeops)

`npm run test:integration` exits 0 with **13 files / 15 tests, all skipped**. A green CI that proves
nothing about persistence is worse than a red one.

---

## What is correct — keep it

| Project | Control | Evidence |
|---|---|---|
| siomayops | Payment webhook HMAC + `timingSafeEqual`, fail-closed on missing secret / non-hex signature / malformed body; QRIS cannot reach `PAID` without verified settlement | `src/server/payments/webhook-verifier.ts:27-43`; 7 tests pass |
| siomayops | No production credential in git; `PAYMENT_PROVIDER=none` | `.env.example` |
| majelishub | 9-role × 53-permission matrix, walked cell by cell, incl. self-approval refusal and non-delegable roles | `permissions.test.ts` — 6 tests pass on real PG 18.4 |
| majelishub | **Row-level security genuinely works** | see the three-way measurement below |
| majelishub | Hash-chained append-only audit with per-org advisory lock | `writer.ts`; `chain.test.ts` passes on real PG |
| majelishub | `getSession()` fails closed under PGlite rather than trusting a caller identity | `session.ts` |
| majelishub | Token/code ban list enforced at runtime *and* at lint from one data file, with a unit-tested rule | `no-token-logging.mjs` |
| manga | `progress/route.ts` — real session, correct 401, explicit "ignore any userId param" | verified in source; the reference pattern |
| parking | Monotonic tamper-resistant clock; photo retention frozen while an incident is open; plate masking; lost-ticket requires supervisor PIN | 66 tests pass |
| strangerlink | Admin capability matrix with MFA gating, ban enforcement, rate limiting, TURN relay-range blocking, age gate with disabled-by-default consent | 85 tests pass |

## The one measurement worth keeping

`majelishub` is the only project in the workspace with a database-enforced tenant boundary. Verified
on real PostgreSQL 18.4, `SET LOCAL ROLE majelishub_app` inside a transaction:

```
owner connection,  no scope            →  SELECT … FROM kajian_events  =  both orgs' rows
majelishub_app,    no scope            →  []                          (fail closed)
majelishub_app,    app.organization_id = Org A  →  Org A's row only
```

That is the pattern `homeops` should copy, and the proof that the "RLS" in this workspace is not
theatre. What is theatre is the PGlite path used for all its evidence, where
`withScopedTransaction` returns a bare transaction and
`scripts/pglite-migrate.mjs` explicitly skips `ENABLE RLS` and `CREATE POLICY`.
