# Yomi — Architecture

**Status:** canonical. Describes the architecture Yomi has, and the one it must
reach. Not a plan — see [execution/MASTER_PLAN.md](execution/MASTER_PLAN.md) for
that, and [execution/CHECKLIST.md](execution/CHECKLIST.md) for status.

## 1. The shape

TypeScript, Next.js App Router, PostgreSQL via Drizzle, S3-compatible object
storage. One process. No queue, no cache tier, no search service.

```
browser
  │
  ├─ RSC /api/v1/*        catalog reads (anonymous)      ─┐
  ├─ RSC /api/*           members' reads (session)       ─┤  two seams today,
  │                                                     │  see §3
  └─ /media/{assetKey}    images, anonymous for published │
                         │                               │
                    composition root  ← the only place a connection is opened
                         │
                    features/*        ports + services, no SQL, no HTTP
                         │
                    server/db/repositories/*   the only SQL in the app
```

The dependency rule is one-directional and machine-checked
(`scripts/check-boundaries.mjs`, 7 rules with a control):

- `features/*` never imports `server/*`
- only `server/db` imports Drizzle
- only `server/storage` imports the S3 SDK
- only `server/telemetry` imports OTel packages
- app routes never import `server/*` directly — they use a seam

## 2. Layers and their contracts

| Layer | Directory | May import | Owns |
|---|---|---|---|
| Contracts | `src/shared/contracts/` | nothing | DTO shapes, `AppError` codes |
| Feature | `src/features/<area>/` | contracts | ports (interfaces), services |
| Adapters | `src/server/db/repositories/`, `src/server/storage/` | contracts, features | all SQL, all object I/O |
| Runtime | `src/server/composition.ts` | all of the above | the one `Db`, wiring |
| Transport | `src/app/api/**` | contracts, seams | validation, status codes, cookies |

The inversion is deliberate: `features` declares `LibraryRepository`; `server/db`
implements it. A feature never learns it is talking to PostgreSQL.

## 3. The two seams, and the one connection

There are currently **two** transport seams that both need a database handle:

- `src/app/api/_runtime.ts` — the members' seam. **Has a real caller resolver.**
- `src/app/api/v1/_runtime.ts` — the catalog seam. **`resolveCaller()` returns
  `null` unconditionally** (`_runtime.ts:33`), so every `/api/v1` route behaves as
  anonymous. `CatalogService.detail` short-circuits on it, which is why
  `continueReading` can never populate and the "Continue" button on manga detail is
  dead code. (F-009.)

Both open their own `Db`. And `server/auth/guard.ts:22` (`getSessionUser`) opens and
closes a **third** pool per call. So a single members' request can hold three
pools (F-001).

**Target:** one `getOrCreateDb(env)` per process. The composition root builds it
once; every repository and both seams receive it. `getSessionUser` takes the handle
rather than making its own.

**Composition roots today:** `createCatalogComposition` (catalog) and
`createLibraryComposition` (members). Two roots are acceptable — they have
different lifetimes and different callers. Two *connections* is not.

## 4. Sessions: three implementations, one authority

| Implementation | Status | Problem |
|---|---|---|
| `features/auth/session.ts:22` `SessionRepository` (6 methods) | **no implementation** — `server/auth/session-store.ts:24` throws `T-AUTH-006` | The port that documents sliding-idle and absolute expiry has never run. `computeSessionExpiries:63` throws too. |
| `server/auth/guard.ts:22` `getSessionUser` | real, working | **Bypasses the port.** Own pool per call. Accepts an `x-session-token` header (`:25`), which is a token in a place logs and proxies record. `requireUser:43` throws a bare `Error`, not an `AppError`. |
| `api/auth/login` / `logout` | real, working | Bypasses **both** — calls `insertSession`/`deleteSessionByToken` from `queries/reader-state.ts` directly. |

Three code paths answer "is this user signed in", and they can disagree. F-002 makes
the port the only authority and deletes the ad-hoc helpers.

## 5. Ports: 10 of 20 have no implementation

| Implemented | Not implemented |
|---|---|
| `MangaRepository`, `ChapterRepository`, `CatalogVocabularyPort` | `SearchRepository` |
| `LibraryRepository`, `BookmarkRepository` (one file) | `UserRepository` |
| `HistoryRepository` | `SessionRepository` (throws) |
| `ResumePositionReader`, `ReaderProgressRepository` | `PasswordHasher` (argon2 imported ad-hoc in the login route) |
| `ProgressReader` (via `ResumeService`) | `UploadJobRepository` |
| `CatalogService`, `LibraryService` | `SearchService`, `AuthService`, `AdminService`, `UploadPipeline`, `AuditSink` |

`PLANNED_REPOSITORIES = ['user','session','search','upload-job']` is
machine-checked against the filesystem by `scripts/check-claims.mjs` and is
**accurate but incomplete** — it tracks repositories, not the four services plus
`PasswordHasher` and `AuditSink`. F-023 extends it.

`ReaderProgressRepository` is implemented and then **bypassed** by the reader's own
route (§7). An implemented port nobody calls is not a working feature.

## 6. Media delivery

`/media/{assetKey}` is application-mediated (ADR-004/005) and is the reason the S3
bucket is not public. It resolves the key, checks the caller's authorisation against
the owning chapter's publication state, and streams bytes. All 23 of its tests pass.
`getStream` is proven not to materialise the object.

**This is the one lane with no open defect.** An earlier report of "4 failing media
tests" was a harness mistake — running with `NODE_ENV=production` over `http://`,
which `loadEnv()` correctly refuses (NFR-SEC-009), after which the route turns the
boot failure into a §6 500. F-022 pins `NODE_ENV=test` so that mistake cannot
recur.

## 7. The architecture bypass

Two routes build their own `Db` per request and call
`server/db/queries/reader-state.ts` directly, skipping the composition root, the
service layer and the ports:

- `api/v1/chapters/[id]/pages`
- `api/chapters/[id]/progress`

That file's own header calls itself a "Minimal wave2 implementation" with no
requirement IDs and no task ID. It is the source of **both** the completion-erasure
defect (§7 of [MVP.md](MVP.md)) and the bypass itself. It is deleted in F-006-S2;
`queries/reader-state.ts` has no reason to exist once the ports do.

`mergeProgress` — fully implemented, with a proper three-phase batch merge and its
own LWW rule — has **zero callers**. Not a defect; an unwired capability.

## 8. Test harness

Vitest. 51 files, 605 tests. `vitest.config.ts` does **not** pin `NODE_ENV` (F-022).
E2E is Playwright, excluded from the Vitest project, and **not in CI** (F-021).
**13 suites are skipped** — a skipped suite is a silent hole, and F-023 requires each
to get a task ID or be deleted.

The two catalog repository suites use a `truncate … cascade` reset against their own
throwaway `t_catalog_*` database, so they do not share fixtures. The
`media-*` suites and `openCatalogDatabase` suites use per-suite throwaway databases
via an advisory lock. Shared-database suites must never truncate; the rule is in
`media-delivery.test.ts`'s own header.

## 9. Target architecture

Everything in this section is work, not description.

1. **One connection per process** (F-001).
2. **One session authority** (F-002).
3. **Every route through a seam; no direct DB** (F-006).
4. **Every task ID accounted for** by the checker (F-023), and no `WIRED` bucket —
   a task that is both a `TODO` and mentioned in a file is blocked, not wired.
5. **E2E in CI** (F-021).
6. **One status document** (`execution/CHECKLIST.md`). The 15 `MVP_AUDIT` markdown
   files, 7 of which claim search/auth/admin complete when they are not, are
   archived (F-020).
