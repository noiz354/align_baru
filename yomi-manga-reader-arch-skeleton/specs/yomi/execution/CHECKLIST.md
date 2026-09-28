# Yomi Master Execution Checklist

**This is the operational source of execution status.** Nothing else records
status. If a completion claim appears anywhere but this file, it is not a claim.

Companions: [MASTER_PLAN.md](MASTER_PLAN.md) (plan) · [DEPENDENCY_GRAPH.md](DEPENDENCY_GRAPH.md)
(order) · [VERIFICATION_MATRIX.md](VERIFICATION_MATRIX.md) (evidence required).

## Baseline

- **branch:** `main`
- **commit:** `7af4e6a` — *feat(members): wire library, bookmarks and history to real data*
- **tests:** 605
- **pass:** 605
- **fail:** 0
- **known baseline failures:** **0.** Expected baseline failures = 0. ✅ *Verified
  2026-09-28 under `NODE_ENV=production` by F-022-S1 — the shell no longer changes
  the answer.* The four media failures once reported here were a **measurement
  error**: the suite had been run with `NODE_ENV=production` over `http://`, which
  `loadEnv()` correctly refuses (NFR-SEC-009), after which the media route returns a
  §6 500 by design. CI always set `NODE_ENV=test`
  (`.github/workflows/project-checks.yml:108`) and was never red. That harness gap is
  now closed.
- **authority:** auth deferred 2026-09-28. See [MASTER_PLAN.md](MASTER_PLAN.md).
- **verification limit:** none. A seeded account can sign in, so member journeys are
  browser-verifiable. Only *registration* is impossible.

## Completion rules

A checkbox becomes `[x]` only when backed by **evidence** recorded in that slice's
"Completion evidence" block. Required, where the slice touches them: code exists ·
build succeeds · the tests **actually execute** (not skipped) · acceptance criteria
pass · negative path tested · persistence verified · user ownership/isolation
verified · runtime behaviour verified · documentation reconciled.

**Never sufficient on its own:** code review · grep · file existence · TODO removal ·
a screenshot · an agent's assertion.

Regression gates before every commit:
`npx tsc --noEmit` · `npx eslint .` · `node scripts/check-boundaries.mjs` ·
`node ../scripts/check-claims.mjs` · `npx vitest run tests/unit tests/integration` ·
`npx next build`

---

## Wave 0 — Gate truth

Nothing below is trustworthy until these four land. No product code changes.

### F-022-S1 — Pin `NODE_ENV=test` in the local test harness

- [x] spec complete
- [x] dependencies satisfied
- [x] implementation complete
- [x] migration complete / N/A
- [x] unit test complete
- [x] integration test complete
- [x] negative-path verification
- [x] user isolation verification / N/A
- [x] build/typecheck/lint
- [x] acceptance criteria verified
- [x] documentation reconciled
- [x] commit created
- [x] evidence recorded

**Acceptance**
- `vitest.config.ts` sets `NODE_ENV='test'` for the test environment
- `NODE_ENV=production npx vitest run` → 605 pass / 0 fail
- the 4 media tests pass identically under `NODE_ENV=production` and `NODE_ENV=test`
- a shell with `NODE_ENV=production` can no longer produce a phantom media failure

**Verify:** `NODE_ENV=production npx vitest run tests/integration/media-delivery.test.ts`
→ 23 pass / 0 fail

**Files:** `vitest.config.ts` (1 file)

Completion evidence:
- Commit: F-022-S1
- Tests: `NODE_ENV=production` media-delivery 4 fail/15 pass → **19 pass (19)**.
  Full suite **601 pass / 4 fail → 605 pass / 0 fail**. Identical with no `NODE_ENV`
  and with `NODE_ENV=bogus`.
- Commands: `NODE_ENV=production npx vitest run tests/integration/media-delivery.test.ts`
  · `NODE_ENV=production npx vitest run tests/unit tests/integration`
  · `npx tsc --noEmit` · `npx eslint .` · `node scripts/check-boundaries.mjs`
  · `node ../scripts/check-claims.mjs` · `npx next build`
- Notes: **Mutation recorded** — removing the `env` line returns exactly 4 failures;
  restoring it returns 19/19, so the pin is the cause. **The production rule is
  intact**: production + `http://` still refuses to boot (NFR-SEC-009), so the pin
  scopes to the Vitest process only. Diff is 1 file, +17 lines, nothing under
  `src/`, `src/app/media/` byte-identical.

---

### F-023-S1 — Make the status checker cover everything unimplemented

- [x] spec complete
- [x] dependencies satisfied
- [x] implementation complete
- [x] migration complete / N/A
- [x] unit test complete
- [x] integration test complete / N/A
- [x] negative-path verification
- [x] user isolation verification / N/A
- [x] build/typecheck/lint
- [x] acceptance criteria verified
- [x] documentation reconciled
- [x] commit created
- [x] evidence recorded

**Acceptance**
- `PLANNED_REPOSITORIES` (or an equivalent machine-checked list) names all 10
  unimplemented ports: `SearchRepository`, `UserRepository`, `SessionRepository`,
  `PasswordHasher`, `UploadJobRepository`, `AdminService`, `AuthService`,
  `SearchService`, `UploadPipeline`, `AuditSink`
- `check-claims.mjs` fails if any listed port gains a file without the list changing
- each of the **13 skipped** test suites has a task ID or is deleted
- the checker cannot report a task as complete while a `TODO` naming it exists
- a fixture proves the checker fails on a planted violation (not just that it passes)

**Verify:** plant a `TODO(T-READER-021)` in a scratch file → checker reports BLOCKED
→ remove → reports as before.

**Files:** `scripts/check-task-status.mjs`, `../scripts/check-claims.mjs`,
`src/server/db/repositories/index.ts`

Completion evidence:
- Commit: F-023-S1
- Tests: 605 passed / 0 failed (unchanged). Claims checked 38 → **61**, all
  consistent. Task state **unchanged** at BLOCKED 20 · STUB 36 · ABSENT 81 — the
  scan now excludes documentation, which corrects the *evidence* without moving a
  single task. Skipped suites surfaced: 0 → **13**, 0 unnamed.
- Commands: `node ../scripts/check-claims.mjs [--json]`
  · `node scripts/check-task-status.mjs [--json|--strict]`
  · 4 planted mutations · `npx tsc --noEmit` · `npx eslint .`
  · `node scripts/check-boundaries.mjs` · `npx vitest run`
- Notes: **Four mutations, all caught.** Deleting the `T-OBS-001` throw → 60/1
  contradicted; deleting a listed stub's file → contradicted; planting an unnamed
  `describe.todo` → reported and fails `--strict`; planting `TODO(T-FOUND-001)` on
  an `ABSENT` task → ABSENT 81→80, STUB 36→37, restored. **Three earlier attempts
  at those mutations were wrong**: one replaced a string that had a suffix so it
  was a no-op, one planted a TODO on a task that was already `STUB` so the counts
  could not move, and the id pattern initially rejected `INT-SEARCH-001` and called
  a correctly-identified file unnamed. All were caught by printing the counts
  instead of trusting the assertion. **Also fixed here:** adding `specs/` had given
  T-READER-021 a `todo` pointing at `CHECKLIST.md` — a promise read as a stub.
  `specs`, `MVP_AUDIT` and `docs` are now excluded from the evidence scan;
  `TASKS.md` deliberately stays. Not fixed, recorded: `../scripts/check-claims.mjs`
  fails `prettier --check`, as it already did at `HEAD~1`; it is root-harness code
  outside the Yomi prettier gate, and formatting it would add unrelated churn to a
  file 8 projects share.

---

### F-020-S1 — Archive the stale status documents

- [x] spec complete
- [x] dependencies satisfied
- [x] implementation complete
- [x] migration complete / N/A
- [x] unit test complete / N/A
- [x] integration test complete / N/A
- [x] negative-path verification / N/A
- [x] user isolation verification / N/A
- [x] build/typecheck/lint / N/A
- [x] acceptance criteria verified
- [x] documentation reconciled
- [x] commit created
- [x] evidence recorded

**Acceptance**
- the 15 `MVP_AUDIT` markdown files move to `MVP_AUDIT/archive/`; none is deleted
- 7 of them falsely claim search/auth/admin complete — each is annotated as such in
  the archive, not silently dropped
- documents covering *other* projects (parking, chores) are labelled, not merged
- 10 screenshot scripts are reduced to one working script or archived with a note
  on why each was kept
- no file outside `MVP_AUDIT/` claims a completion state

**Files:** `MVP_AUDIT/**` only

Completion evidence:
- Commit: F-020-S1
- Tests: 605 passed / 0 failed. **0 product files changed** — the diff is
  documentation only.
- Commands: `git status --porcelain` (10 × `D` + `??` = renames, not removals)
  · `grep -rlE "MVP_READY\|MVP_PARTIAL\|RUNNABLE_DEMO" MVP_AUDIT/*.md` → only the
  new README, which quotes those terms to say they are false
  · full regression gates
- Notes: 10 matrices moved to `MVP_AUDIT/archive/` and annotated in place, each
  naming the specific false claim rather than "outdated". Worst three:
  `MVP_MATRIX_FINAL` (nothing about `7af4e6a` is compatible with "FINAL");
  `MVP_MATRIX_WAVE3` (grades Yomi on "authenticated" when no account can be
  created — the isolation half is true and mutation-proven, the auth half is not);
  `SEED_DATA` (documents plaintext passwords the seed now **refuses**, so the
  values were deliberately not reproduced in the annotation). `RUNTIME_COMMANDS`
  and `SEED_DATA` also contradict each other inside the same archive.
  **A second record corrected:** the master gap audit said "10 screenshot scripts"
  — there are 3, and only `screenshot-yomi.mjs` is Yomi's. The other two capture
  HomeOps (`/chores`) and the parking app (`/queue`) and were **left in place**,
  labelled rather than archived: they are another project's tooling.

---

### F-024-S1 — Traceability headers on the reader and auth routes

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete / N/A
- [ ] integration test complete / N/A
- [ ] negative-path verification / N/A
- [ ] user isolation verification / N/A
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `src/app/manga/[slug]/chapter/[chapter]/page.tsx` carries requirement + task IDs
  (it has **no header comment at all** — AGENTS.md §4.2 failure)
- `reader-client.tsx` likewise; its only task ID today is `T-UPLOAD-004` at `:156`
- `api/v1/chapters/[id]/pages/route.ts` no longer calls itself a
  "Minimal wave2 implementation" — it is either wired (F-006) or says honestly what
  it is
- `api/auth/login` and `api/auth/logout` have header comments
- `manga/[slug]/page.tsx:41-44` stale comment fixed: `continueReading` **is** parsed
  (`catalog-schema.ts:98`) and consumed at `:142`

**Verify:** `grep -L "Task: T-" <the 5 files>` returns nothing

**Files:** 5 files, comments only

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

## Wave 1 — Runtime

### F-001-S1 — One `getOrCreateDb` per process

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- a single `getOrCreateDb(env)` memoised per process
- `api/_runtime.ts` and `api/v1/_runtime.ts` share one handle
- two consecutive requests in one process open **one** pool, proven by counting
- a test asserts the pool count, not that the code "looks memoised"
- dev hot-reload does not leak a pool per reload

**Files:** `src/server/db/client.ts`, `src/app/api/_runtime.ts`,
`src/app/api/v1/_runtime.ts`, `src/server/composition.ts`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-001-S2 — `getSessionUser` takes the shared handle

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `server/auth/guard.ts` no longer opens or closes a pool per call
- the total pool count for one members' request is **1**, down from up to 3
- `requireUser` throws an `AppError`, not a bare `Error` (ERROR_MODEL §6 C-13)
- the `x-session-token` header path is removed or justified in writing (C-6: tokens
  leak via logs, proxies and `Referer`)

**Files:** `src/server/auth/guard.ts`, `src/app/api/_runtime.ts`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

## Wave 2 — Search ★

### F-010-S1 — `createSearchRepository`: ranking bands, trigram, keyset cursor

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A (the trigram indexes already exist)
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification / N/A (anonymous)
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- 4 integer ranking bands in order: exact > prefix > contains (trigram) > related
- A–Z then id tie-break, applied **within** a band
- keyset cursor; page 2+ returns different rows from page 1
- ordering asserted on a fixture designed to break it (not a 1-row fixture)
- **mutation-proven**: break the tie-break → a test fails; break the band order →
  a test fails

**Verify:** `npx vitest run tests/integration/search-repository.test.ts`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-010-S2 — Creator/tag related band; CJK 1–2 char prefix-only path

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification / N/A
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- a 1–2 character CJK query takes the **prefix path only** and never the trigram
  `contains` path (which is meaningless at that length and is the expensive one)
- creator and tag matches resolve via `manga_creator` / `manga_tag` into the related
  band
- `kinds` (`manga` | `creator` | `tag`) and `match field`
  (`title` | `alias` | `creator` | `tag`) are honoured
- a 3-character CJK query *does* use the trigram path — both sides of the boundary
  are tested

**Files:** `src/server/db/repositories/search.repository.ts`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-011-S1 — `createSearchService`: validation and cursor codec

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete / N/A
- [ ] negative-path verification
- [ ] user isolation verification / N/A
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `q` trimmed, 1..120; empty → no search; >120 → 4xx **before** any query runs
- the cursor is signed or opaque; a tampered or truncated cursor is **refused**, not
  repaired (ERROR_MODEL §4)
- a cursor from a different query is refused
- `createSearchService` no longer throws `T-SEARCH-001`

**Files:** `src/features/search/search.service.ts`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-011-S2 — `GET /api/search`, anonymous allowed

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification / N/A
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- replaces the throwing `api/search/route.ts`; the `T-SEARCH-003` throw is gone
- **no session required** — an anonymous request gets 200, not 401
- responses are `no-store` (PRIVATE_CACHE_CONTROL)
- oversized `q` and a bad cursor both answer 4xx
- the URL mismatch is resolved: the page's claimed `GET /api/v1/search` is either
  created or the comment corrected — one, not both

**Files:** `src/app/api/search/route.ts`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-012-S1 — `/search`: results, states, pagination

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete / N/A
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification / N/A
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `NotYetBuilt` is gone
- empty / no-results / error / results are four **distinct** honest states; an error
  is never rendered as "no results"
- result rows are keyboard-navigable and labelled; result count is announced
- load-more on the opaque cursor, appending without losing focus
- a11y: heading order correct, nothing colour-only

**Files:** `src/app/search/**`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-012-S2 — Deep-linkable query in the URL

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete / N/A
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification / N/A
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- typing updates the URL; reloading restores the query and results
- the back button moves through searches
- a shared URL reproduces the same result set for another reader
- an empty query does not leave a meaningless `?q=`

**Files:** `src/app/search/**`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

## Wave 3 — Reader navigation

### F-007-S1 — Previous/next chapter from inside the reader

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification / N/A (reading is anonymous)
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- the reader stops **discarding** the chapter list it already fetches (`:78`)
- previous/next published chapter are reachable from inside the reader
- the control is disabled at the ends, exactly as page nav already is
- the neighbours come from `ChapterRepository.pageList`, which already returns them
  per its own port doc (`chapters.repository.ts:31`) — **no new query**
- an unpublished neighbour is not offered

**Files:** `src/app/manga/[slug]/chapter/[chapter]/reader-client.tsx`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-007-S2 — `?page=N` deep link, clamped

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification / N/A
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `?page=N` opens page N
- `N > pageCount` clamps to `pageCount`; `N < 1`, `N=0`, `N=-1`, `N=abc`, `N=` all
  clamp to 1 — every one tested
- the `?page=N` href that `/bookmarks` already builds now lands correctly
- clamping happens where it belongs: the **service**, not the repository, which
  returns raw deliberately (EC-RDR-10)

**Files:** `src/app/manga/[slug]/chapter/[chapter]/page.tsx`, `reader-client.tsx`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

## Wave 4 — Reader correctness ⚠ carries the P0

### F-006-S1 — Route the reader's progress save through the repository

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance — the defect, stated as a test**
- **before:** reading past the end of a completed chapter sets `completed = false`
  (this test must fail against `7af4e6a`)
- **after:** it stays `true`
- the save path calls `ReaderProgressRepository.saveProgress`, so the LWW guard,
  the idempotence predicate and the sticky-OR all apply
- `library_entry.last_read_at` is maintained by the same write, so the shelf's
  `last_read_desc` is no longer NULL for anything read in the reader
- **mutation-proven**: restore `completed: progress.completed` → the new test fails
- **reviewed for the whole lost-check class** — see ERROR_MODEL §4. A direct-DB →
  service rewire is exactly when a check that fell out of an already-read row
  disappears; list what this route lost and where each check now lives
- the 401 path keeps working (anonymous cannot save)

**Files:** `src/app/api/chapters/[id]/progress/route.ts`,
`src/server/db/queries/reader-state.ts` (upsert removed)

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-006-S2 — Delete `queries/reader-state.ts`; move `pageList` behind the seam

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `src/server/db/queries/reader-state.ts` is **deleted** — it is the source of both
  the erasure defect and the architecture bypass
- every caller moved: progress save, progress restore, `insertSession`,
  `deleteSessionByToken`, `pageList`
- `api/v1/chapters/[id]/pages` and `api/chapters/[id]/progress` build no DB handle of
  their own; they use the seam
- no route imports `server/*` directly (boundary rule D6)
- `mergeProgress` is either wired or documented as an intentionally unwired
  capability — not left looking like an oversight

**Note:** `insertSession`/`deleteSessionByToken` move to the session port, which is
auth-track work. Until F-002 lands, they move to a **non-auth** home
(`server/db/repositories/session.repository.ts` as a plain implementation) so this
slice does not depend on the session port. F-002 then makes the port the authority.

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-008-S1 — `unsetCompleted`: the missing port operation

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `unsetCompleted(userId, chapterId)` on the port and the repository
- **its own transaction and its own LWW guard** — it is not a flag flip smuggled
  through `saveProgress`, because that path is sticky-OR and structurally cannot
  clear a flag
- sticky-OR is **preserved** for `saveProgress`; the two paths do not interfere
- `library.service.ts:189-200` `setReadStatus(false)` calls it and stops being a
  documented no-op (SQ-LIB-7 closed)
- unsetting a chapter with no progress row is a safe no-op, not a throw
- unsetting a chapter that is **not the caller's** changes nothing, proven by test
- `setReadStatus`'s zero-caller status is resolved: it is either wired or deleted

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-009-S1 — A real caller resolver on the `/api/v1` seam

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `src/app/api/v1/_runtime.ts:33` no longer returns `null` unconditionally
- **integration test:** a signed-in caller makes `continueReading` populate. This
  test must fail against `7af4e6a` — the "Continue Ch. 12 · p. 45" button is dead
  code today
- an anonymous caller still gets the anonymous shape (no regression for J-04/J-05)
- the stale comment at `manga/[slug]/page.tsx:41-44` is corrected (also F-024)
- **browser-verified** with a seeded account: the button shows a real position

**Files:** `src/app/api/v1/_runtime.ts`, `src/features/catalog/catalog.service.ts`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

## Wave 5 — Content services (layered; no routes)

### F-016-S1/S2 — `AdminService`: manga and chapter CRUD

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `createAdminService` no longer throws `T-ADMIN-001`
- manga: list, create, update, publish/unpublish
- chapter: list, create, update, publish, reorder
- publish is a state transition, not a boolean write — a chapter needs
  `published_at`, and unpublishing is distinguishable from "never published"
- an unknown manga or chapter is the §6 code, not an FK 500 (the lesson of
  ERROR_MODEL §4, applied before the code is written)
- **no route, no page, no form.** `F-005` is deferred, and an unguarded admin route
  is a P0 regression this plan would introduce

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-017-S1 — Single-part upload service

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A (`upload_job` untouched)
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- `createUploadPipeline` no longer throws `T-UPLOAD-006`; a single-part ingest path
  exists: validate → store objects → write `chapter_page` rows → publish
- object keys follow the contract the seed established:
  `pages/{chapterId}/{32-hex}.{avif|webp|jpeg}` — the same rule, one implementation
- a rejected upload leaves **no** partial rows
- **no route, no page, no form** (same constraint as F-016)

**Note:** the resumable multi-part `upload_job` pipeline is **replaced, not
completed** ([MASTER_PLAN.md](MASTER_PLAN.md)). `image-processor.ts` still throws
`T-UPLOAD-004` and `prepare-chapter-upload.ts` still throws `T-UPLOAD-014` — that is
recorded, not hidden.

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

### F-013-S1/S2 — `reader_preference`: give the orphaned table an owner

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A (the table exists)
- [ ] unit test complete
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- a `ReaderPreferenceRepository` over the existing table
- `GET` returns stored values or the documented defaults on first read
- `PUT` validates against the table's 2 CHECK constraints
- the route is **self-scoped only** — it touches the caller's own row and is never
  admin-gated, so it is safe to ship while the guard is deferred
- the reader actually **consumes** at least one preference, or the feature is a lie
  in the same way the orphaned table already is
- `docs/product/reader-behavior.md` stops describing `zoomDefault` and
  `autoNextChapter` as live until they are

**Files:** repository, service, `api/preferences/`, `app/settings/`

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

## Wave 6 — Assurance

### F-021-S1 — Get E2E into CI

- [ ] spec complete
- [ ] dependencies satisfied
- [ ] implementation complete
- [ ] migration complete / N/A
- [ ] unit test complete / N/A
- [ ] integration test complete
- [ ] negative-path verification
- [ ] user isolation verification
- [ ] build/typecheck/lint
- [ ] acceptance criteria verified
- [ ] documentation reconciled
- [ ] commit created
- [ ] evidence recorded

**Acceptance**
- the 5 non-todo e2e specs run in CI: `catalog-journey`, `catalog-perf`,
  `route-map`, `shell-a11y`, `catalog-a11y`
- a job exists; it is not a skipped or `continue-on-error` step
- `.github/workflows/project-checks.yml` gains a job — E2E is currently absent
- the 13 `describe.todo` specs are either implemented or deleted (with F-023)
- `vitest.config.ts` continues to exclude `tests/e2e` so the two runners do not
  double-count

Completion evidence:
- Commit:
- Tests:
- Commands:
- Notes:

---

## Deferred — not cancelled

| Slice | Work | Blocked by |
|---|---|---|
| F-002-S1/S2 | `SessionRepository` implementation; make the port the single session authority; delete the ad-hoc helpers | auth restart |
| F-003-S1…S4 | `UserRepository`, `PasswordHasher`, `POST /api/auth/register`, the register page | F-002 |
| F-004-S1 | `/auth/signin` real form, `?next=` allowlist, uniform failure message | F-003 |
| F-005-S1/S2 | real `matcher`; admin tree requires `role=admin` | F-002 |
| F-008-S2 | wire `setReadStatus` to a route | F-002, F-006 |
| F-014-S1 | `/settings` page | F-013 |
| F-015-S1 | account deletion, cascading | F-002 |
| F-016/017 routes | admin + upload routes and pages | **F-005** — prohibited until then |
| F-018-S1 | admin users/uploads/audit views | post-MVP |
| F-019-S1 | `AuditSink` + audit viewer | post-MVP |

## Out of MVP

`T-READER-021/022` are covered by F-006/F-008. Resumable multi-part upload
(F-020 decision). Recommendations, social, offline. Anything not in
[MVP.md](../MVP.md).

---

## Progress log

| Date | Slice | Commit | Result |
|---|---|---|---|
| 2026-09-28 | plan authored | `36b36ee` | 24 features, 35 slices, auth deferred |
| 2026-09-28 | F-022-S1 | `425ac7d` | baseline now 605/605/0 under any shell; production rule proven intact |
| 2026-09-28 | F-023-S1 | `65ba386` | stub inventory covers 23 throws; 13 skipped suites now counted; docs no longer count as evidence |
| 2026-09-28 | F-020-S1 | *this commit* | 10 false status matrices archived + annotated; one status source remains |
