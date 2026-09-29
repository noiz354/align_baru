# F-011-S1+S2 — ACCEPTANCE: the search service and `GET /api/search`

S1 and S2 in one commit: the service is untestable apart from the repository it
takes, the route is untestable apart from the service it takes, and the cursor
contract spans all three. Splitting them would manufacture a seam in the work
where there is none in the code.

## A1 — The service owns the REQUEST

`q` trimmed 1..120, empty or overlong → `SEARCH_QUERY_INVALID` before any query
runs. Limit defaults 24, clamps to 48. Assembly strips `score` — the wire carries
the band, which is the whole of the ordering contract, and a second number would
be a second ranking for clients to disagree about.

The cursor is BOUND to the query that minted it: `{v:1, q, inner}` base64url. A
position without its query is a wrong page waiting to happen — the repository
never sees the query the cursor is USED with, only the one it is called with, so
the binding cannot live there. Three refusals, three codes: malformed →
`CATALOG_PAGE_INVALID` (a bad position, like every other bad cursor in the app);
well-formed but foreign → `SEARCH_QUERY_INVALID` (the pair is wrong, neither half
is); never a repair into page 1 (ERROR_MODEL §4).

- [x] `createSearchService` no longer throws `T-SEARCH-001`
- [x] a cursor from a different query is refused, and no query runs
- [x] tampered, truncated and wrong-shaped cursors are refused

## A2 — The route owns the TRANSPORT

`GET /api/search?q=&cursor=&limit=`, anonymous, `no-store`, 422s passed through
with their codes, 429 with `Retry-After: 60` at 30/min/IP.

- [x] the `T-SEARCH-003` throw is gone; anonymous gets 200, not 401
- [x] oversized `q` and a bad cursor both answer 4xx
- [x] the URL mismatch is resolved by CORRECTION, not duplication: the page
  claimed `GET /api/v1/search`, the contract names `/api/search`, and a second
  route to the same rows would be a second surface to guard, rate-limit and keep
  in sync — one, not both
- [x] the route reads the `/api/v1` seam rather than growing a third registry:
  one public composition, one lazy singleton, one pool

The rate limit is an in-process sliding window, and says so: enough for the
self-hosted reader (one process, one box), documented as NOT enough for
multi-instance. An "unknown" IP shares one bucket — degrading to a global 30/min
rather than to no limit. The limit counts requests, not searches: the check runs
before validation because its job is bounding load, and running it after would
require the route to duplicate the service's 1..120 rule to decide what counts.

## A3 — The layers agree with each other

`search-repository.test.ts` proves the rows, `search-service.test.ts` proves the
request with a fake repository, `search-route.test.ts` proves the transport with
a fake service — and `search-e2e.test.ts` wires the REAL service over the REAL
repository and drives the REAL route handler with it. A cursor envelope the
repository cannot decode, or a `SearchHit` the route cannot serialise, passes the
first three suites and fails the fourth.

## A4 — Two corrections worth recording

**The `as never` casts were hiding the wiring.** A first version cast the fakes
past the type checker, and `no-unnecessary-type-assertion` flagged five of them
— correctly, because the stubs already satisfied the ports. A cast on a fake says
"trust me", and the whole point of these tests is to verify the shape the cast
would assert. The remaining casts are only where the fake is deliberately
partial, and each says why.

**The inventory failed the build twice in this slice.** `PLANNED_STUB_PORTS`
listed the service and the route as throwing stubs after both had stopped
throwing, and `check-claims.mjs` refused the build until the entries were
removed. Both checkers (this one and `PLANNED_REPOSITORIES` in F-010) exist for
exactly this: an inventory that cannot go stale.

## A5 — Mutations

| Injected | Result |
|---|---|
| `q` not trimmed | **4 tests fail** |
| the 120-char ceiling removed | 1 test fails |
| the foreign-cursor check removed | 1 test fails |
| the limit clamp removed | 2 tests fail |
| the rate ceiling raised to 3000 | **4 tests fail** |
| the rate check removed | **4 tests fail** |

## A6 — Gates

- [x] 711 → **741 passed (741)** (30 new: 15 service, 11 route, 4 composed)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles

## A7 — What is NOT claimed

- The page (F-012). The route is real and served; `/search` still admits it is
  not there.
- A shared rate-limit store. One process, one box; multi-instance needs a store
  and this says so where the limiter lives.
- `totalHint`. The contract lists it optional, the repository does not count,
  and a count would be a second query on every search for a number nobody
  renders yet. When the UI needs it, it is a service addition, not a rework.

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-011-S1+S2 |
| Files | `features/search/search.service.ts`, `app/api/search/route.ts` (both real), composition + seam wiring, `app/search/page.tsx` (comment), 3 tests, `PLANNED_STUB_PORTS` trimmed |
| Tests | +30 |
| Mutations | 6 of 6 caught |
| Commands | 6 mutations · full regression gates · `next build` |
| Notes | The search API is live. The page is next, and it is the only remaining throw on the search path. |
