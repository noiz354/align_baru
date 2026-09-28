# F-001 RUNTIME-DB — ACCEPTANCE

## A1 — One pool, measured rather than asserted

- [x] two `acquireDb` calls return the same handle
- [x] eight concurrent `acquireDb` calls return one handle
- [x] **both composition roots together cost exactly ONE PostgreSQL backend**,
      verified by counting `pg_stat_activity` before and after

That last one is the acceptance that matters, and the first version of it did not
hold. It compared `acquireDb` with itself and passed even after both roots were
reverted to `createDb` — a green test proving nothing, because the compositions
never exposed their pool. It now counts real backends.

## A2 — Mutations

| Injected | Result |
|---|---|
| acquisition no longer memoised (`if (true)`) | **4 tests fail** |
| both roots reverted to `createDb` | **1 test fails**, `expected 2 to be 1` |

The second mutation is why A1 was rewritten. A test that survives the regression
it was written for is a witness, not a net.

## A3 — Shutdown is correct

- [x] an early `releaseDb` does NOT drain while a holder remains
- [x] the last `releaseDb` drains, and the next `acquireDb` returns a *different*
      handle
- [x] releasing beyond the acquired count stops at zero instead of going negative

## A4 — Failure and mismatch

- [x] a DSN differing from the live pool's is refused, not silently reused
- [x] a failed acquire is NOT memoised — a recovered database is reachable on the
      next request, and a good DSN is not rejected as "changed"

## A5 — `createDb` is unchanged

- [x] a test-owned `createDb` handle is still its own pool and still closable
- [x] `createDb` / `closeDb` signatures untouched; no existing call site edited

## A6 — Gates

- [x] 605 → **613 passed (613)**, 0 failed
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-001-S1 (this commit) |
| Tests before / after | 605 → **613** (8 new) |
| Mutation A | no memoisation → 4 failures |
| Mutation B | roots reverted to `createDb` → 1 failure, `expected 2 to be 1` |
| Commands | `npx vitest run tests/integration/db-singleton.test.ts` · the two mutations · full regression gates · `next build` |
| Notes | S2 (`getSessionUser` takes the handle) is the remaining half and is the third connection; it is not in this commit. |
