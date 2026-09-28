# F-009-S1 — ACCEPTANCE: the caller resolver that was killing the button

## A1 — The defect

`app/api/v1/_runtime.ts` answered `null` for every request, reasoning that all four
`/api/v1` endpoints are anonymous-allowed (API_CONTRACT §2.1). But
`CatalogService.detail` reads a null caller as "this reader has no position" and
**omits** `continueReading` (FR-CATALOG-008). So the "Continue Ch.12 p.45" button
on every manga detail page was dead code: a reader with real saved progress was
told they had read nothing and offered chapter 1.

- [x] the resolver verifies the session and returns a real `CallerContext`
- [x] `continueReading` reaches the wire for a signed-in reader
- [x] anonymous, and signed-in-with-no-progress, both omit the field
- [x] both API seams resolve the caller by the SAME rule, in one place

## A2 — Why twenty-odd tests stayed green

Every catalog test injects `resolveCaller: async () => null`. The seam's type is
`(request: Request) => Promise<CallerContext>`, and a **zero-argument
`Promise<null>` satisfies it** — a function that ignores all its parameters is
assignable to any function type. So the tests called the handler factory with their
own resolver and never took the path a real request takes.

The production resolver is now imported by the test and registered, so the
shipping function is the thing under test.

## A3 — One rule, not two copies

The role narrowing was written out inline in `app/api/_runtime.ts` and again in
the `/api/v1` seam — and the two had **drifted**, the `/api/v1` one to
`Promise<null>`. Two copies of a security rule is one too many: that drift
under-granted, and the next one might not. `toCallerContext` and
`resolveCallerContext` now live in `server/auth/guard.ts`, and both seams are
one-line delegations. A test asserts the two seams grant the same authority from
the same cookie.

## A4 — Two false claims the tests corrected

**The `users_role` CHECK is stricter than the comment said.** A first version of
the fixture seeded a `superuser` to prove the narrowing, and PostgreSQL refused the
INSERT. The CHECK permits only `('reader','admin')`. So the CHECK is the first line
of defence and `toCallerContext` is the second — and the second is not redundant:
a CHECK constrains writes through *this* database, and a row restored from a dump,
a migration or a replication peer is not a write this database saw. The same
happened with `users_status`, which permits `('active','disabled')` and not
`suspended`.

**A parity test that cannot fail on "both broken" is not a parity test.** The first
version only asserted the two resolvers agreed. They agreed — on `null` — because
of the next problem.

## A5 — The nastiest failure in this slice

`openCatalogDatabase` creates a database literally **named** the string passed to
it, at `/${name}`. The first version left `process.env.DATABASE_URL` pointing at
the **base** URL, so the production resolver verified sessions against a database
that had none.

The effect was a whole class of quiet failure at once: the resolver answered
`null` to everything, so **every negative test in the file passed**, and the parity
test passed, and the failure surfaced as "the service is not populating
`continueReading`" — pointing at the wrong layer entirely. Only the positive
assertion caught it, and it blamed the service.

Two changes followed: the environment is redirected to the throwaway database by
path, and the parity test asserts a **non-null** value before comparing. Both are
recorded in the test so the next person does not re-introduce them.

## A6 — The browser found a SECOND defect the integration test could not

The resolver fix was correct and the suite was green. The page still showed
"Read Chapter 1" to a signed-in reader. `readMangaDetail` does not read the
database — it makes a real HTTP request to this app's own origin, and **a React
Server Component's `fetch` does not forward the browser's cookies**. So every read
in `discover/catalog-data.ts` reached `/api/v1` as an anonymous request no matter
who was browsing. For the public catalog that was invisible; for
`GET /api/v1/manga/{slug}` it meant the API genuinely never received a session, and
a correct resolver had nothing to work with.

`_members/member-api.ts` already documents the replay as "not optional" and does
it, and calls this module "the same arrangement for the catalog lane" — true of the
origin reconstruction, not of the cookie.

`caller-resolver.test.ts` could not have caught this: it builds its own `Request`,
so the cookie is present by construction. The page is the only place the replay
matters and the route is the only thing an integration test can reach.
`tests/unit/catalog-data-cookie-replay.test.ts` now pins the header.

### Browser verification (a seeded account, the acceptance criterion)

| Request to `/manga/resume-a` | Action label |
|---|---|
| anonymous | `Read Chapter 1` |
| signed in (reader mid-chapter 2, page 7) | **`Continue Chapter 2 — page 7`** |

### A failure in my own verification, recorded

The first browser run showed nothing, and the first guess — the resolver — was
wrong. The actual cause was that the token file had been written with
`echo "  $TOK"`, so every request carried two leading spaces and the guard
correctly refused the session. Two wrong turns before that, both mine: the
environment was pointed at the base database rather than the throwaway one, and a
parity test that asserted only that two resolvers *agreed* — which is vacuously
true when both answer `null`. The app was right throughout; the harness was not.
Recorded because all three shapes are quiet failures that point at the wrong layer.

## A7 — Mutations

| Injected | Result |
|---|---|
| **the original stub restored** (`return Promise.resolve(null)`) | **2 tests fail** |
| an unrecognised role treated as `reader` (authority widened) | 1 test fails |
| the idle-expiry check removed | 1 test fails |
| the absolute-expiry check removed | 1 test fails |
| the `disabled`-user check removed | 1 test fails |
| **the cookie replay removed** (the page-level defect) | **2 tests fail** |
| an empty cookie sent as `cookie: ''` | 2 tests fail |

The first row is the defect itself, reintroduced deliberately: the suite must fail
on the exact bug it was written for, not merely on something adjacent.

## A8 — Gates

- [x] 638 → **656 passed (656)** (18 new)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles

## A9 — What is NOT claimed

- That the button appears on ANY other page. Verified on `/manga/resume-a` only.
- That the session authority is finished. F-002 still owns the `SessionRepository`
  port, and the guard still bypasses it. This slice made the resolver REAL, not
  correct-by-construction.

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-009-S1 |
| Files | `server/auth/guard.ts`, `app/api/v1/_runtime.ts`, `app/api/_runtime.ts`, `app/discover/catalog-data.ts`, `app/manga/[slug]/page.tsx` (comment), 2 tests |
| Tests | +18, 0 removed |
| Mutations | 7 of 7 caught, including the original defect and the page-level one |
| Commands | 7 mutations · full regression gates · `next build` · browser check on `:3199` |
| Notes | The button works. The defect had two halves and the first fix exposed the second: the resolver was a stub, AND the page's loopback read sent no cookie at all. Three claims in the code's own comments turned out false and the tests corrected all of them. |
