# F-001 RUNTIME-DB — SPEC

Covers S1 (one pool per process) and S2 (`getSessionUser` stops making its own).

## User problem

A single members' request could hold **three** database pools:

1. `createCatalogComposition` called `createDb` independently.
2. `createLibraryComposition` called `createDb` independently.
3. `server/auth/guard.ts` `getSessionUser` opened and closed its own pool **per
   call**.

DEPLOYMENT.md §1 budgets the app 10 connections against a server
`max_connections` of 50. Three pools for one request is a third of the budget
spent before any work happens, and it is spent *per request* — so the cost scales
with traffic rather than being paid once.

Nothing tested this. "The code calls a function" and "there is one pool" are
different claims, and only the second is a property.

## Current implementation

`createDb(env)` builds a fresh driver client every call and is exported from
`server/db/index.ts`. Eight call sites: the two composition roots, the
`auth/login` and `auth/logout` routes, the media route, the progress route, the
chapter-pages route, and `guard.ts`.

## Required behaviour

One pool per process, shared by every composition root, with correct shutdown.
`createDb` keeps its current uncached behaviour so a test or a per-request caller
can own and close a pool it created.

## Scope

- `acquireDb(env)` / `releaseDb(db)` on `server/db/client.ts`, memoised.
- Both composition roots acquire the shared handle and release on `close()`.
- `guard.ts` takes a handle instead of making one.

**Out of scope:** converting the per-request routes (`auth/login`, `auth/logout`,
`media`, `progress`, `pages`) to the shared handle. Those are separate slices
(F-002 for the auth routes, F-006 for progress and pages), and `media` opens its
own deliberately for a per-request authorization check.

## API changes

Two new exports on `server/db/client.ts`, re-exported from `server/db/index.ts`:

| Export | Contract |
|---|---|
| `acquireDb(env, options?)` | Returns the process-wide handle, creating it on first use. Takes a reference. Throws `DatabaseConfigurationError` if the DSN differs from the live pool's. |
| `releaseDb(db)` | Drops one reference; drains when the last one goes. Stops at zero rather than going negative. |

No existing export changes signature. `createDb` and `closeDb` are untouched.

## UI / persistence / schema changes

None. No migration.

## Authorization

None.

## Error behaviour

| Condition | Answer |
|---|---|
| DSN unreachable | `DatabaseConfigurationError`; the rejection is **not** memoised, so the next request retries |
| DSN differs from the live pool's | `DatabaseConfigurationError` naming the mismatch. Silently reusing would read the wrong database — a failure producing plausible data, which is worse than a crash. |
| `releaseDb` called more times than acquired | Stops at zero; the next acquire builds a new pool |

## Edge cases

| Case | Why it matters |
|---|---|
| Next dev hot reload | A module-level cache is discarded on reload while the pool it held is not, so sockets leak. This is why the cache lives on `globalThis` under `Symbol.for` — the key is registry-wide, so it survives module re-evaluation and cannot collide with another copy in the same realm. |
| Both roots call `close()` | Without a refcount the first close drains the pool and the second root keeps a handle to a dead one. That is a use-after-free that only appears at shutdown, which is the worst time to find it. |
| Concurrent first requests | Both seams call `acquireDb` on a cold process. The promise is stored before it settles, so the second caller awaits the same one rather than starting a second pool. |
| A rejected pool | Cached forever, a deployment with a briefly unreachable database replays the first failure for the life of the process. Mirrors the same rule in `app/api/_deps.ts`. |

## Affected files

- `src/server/db/client.ts` — `acquireDb`, `releaseDb`, the slot
- `src/server/composition.ts` — both roots acquire/release
- `src/server/auth/guard.ts` — takes a handle (S2)
- `tests/integration/db-singleton.test.ts` — new
- `tests/integration/catalog.db-harness.ts` — `envSource()` beside `testEnv()`

## Dependencies

None. **BLOCKING** for F-002, F-006, F-009 — all of them touch a seam or a root.

## Acceptance criteria

See [ACCEPTANCE.md](ACCEPTANCE.md).

## Rollback concern

Low but not zero: reverting restores two pools, which is the bug rather than a
defect. The shared handle is additive, and `createDb` still behaves exactly as
before, so a caller can opt out per request.
