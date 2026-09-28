# F-001 RUNTIME-DB — IMPLEMENTATION

## S1 — what was built

`acquireDb` / `releaseDb` on `server/db/client.ts`, memoised on a `globalThis`
slot; both composition roots switched from `createDb`/`closeDb` to
`acquireDb`/`releaseDb`. Four lines changed in `composition.ts`.

## Why `globalThis` and not a module variable

Next's dev server re-evaluates modules on hot reload. A module-level cache dies
with the old module; the pool it held does not, because the driver owns the
sockets. A dev-only leak is still a leak, and the acceptance criterion says so.

`Symbol.for` rather than `Symbol` so the key is in the global symbol registry and
cannot be shadowed by a second copy of this module in the same realm.

## Why a refcount rather than a plain singleton

Both roots hold the handle and both expose a `close`. If the first close drained
the pool, the second root would hold a dead handle — a use-after-free that only
appears during shutdown. So `releaseDb` decrements and only the last one drains.
The test asserts both halves, because the first half alone would pass against an
implementation that drained immediately.

## Why a rejected promise is not memoised

`createDb` is fail-fast. Caching a rejection means a deployment whose database is
briefly unreachable replays the first failure for the life of the process. The
catch block resets `slot.promise` and gives the reference back. This is the same
rule `app/api/_deps.ts` already applies to its composition cache, for the same
reason.

## The test that had to be rewritten

The first version of "gives both composition roots the same pool" did this:

```ts
const library = await createLibraryComposition(...);
const catalog = await createCatalogComposition(...);
expect(await acquireDb(...)).toBe(handle);   // compares acquireDb with itself
```

It passed with both roots reverted to `createDb`, because it never compared the
compositions' pools — the compositions do not expose them. A green test that
cannot fail.

The replacement counts `pg_stat_activity` rows for the current database before and
after building both roots. `createDb` round-trips `select 1`, so each pool costs
one backend: two roots sharing cost 1, two roots not sharing cost 2. The mutation
now reports `expected 2 to be 1`.

`pg_stat_activity` needs no elevated privilege for a row COUNT, so the test does
not need a superuser, and the count is the only thing it reads.

## `envSource()` — a helper that was nearly a third copy

`loadEnv` refuses to start without all nine variables, so a composition root needs
a complete `EnvSource`, not the single-field `testEnv` the harness already
exports. `media-delivery.test.ts` and `seed.harness.test.ts` each build their own
copy of that literal; the alternative was a third.

It was added to `catalog.db-harness.ts` beside `testEnv`, and `db-singleton.test.ts`
imports it from there.

Three failed attempts got there: an anchor that did not match because
`dsnFor` turned out to be at column 0 rather than indented (the `export` keywords
made the file read like a namespace block); an import from
`support/pg-catalog-ports` which does not re-export it; and passing a partial
`{ DATABASE_URL }` to a composition root, which `loadEnv` correctly refused.

That last failure is worth keeping: the refusal is NFR-OBS-006 working. A
misconfigured deployment should fail at boot, not at the first query.

## Files

| File | Change |
|---|---|
| `src/server/db/client.ts` | +`acquireDb`, +`releaseDb`, +slot and its docs |
| `src/server/composition.ts` | 2× `createDb`→`acquireDb`, 2× `closeDb`→`releaseDb` |
| `src/server/auth/guard.ts` | **S2, not in this commit** |
| `tests/integration/db-singleton.test.ts` | new, 8 tests |
| `tests/integration/catalog.db-harness.ts` | +`envSource()` |

## Order of work

1. Read `createDb` and find every call site
2. Check what calls `composition.close()` — nothing in `src/`, which is what makes
   a refcount the honest answer rather than an optimisation
3. Add `acquireDb` / `releaseDb`
4. Switch both roots
5. Write the counting test
6. **Run both mutations and check the counts print the expected failures**
7. Re-run the suite: an earlier version of step 6 passed against a reverted
   implementation
8. Full gates
9. Commit as `F-001-S1`
