# Yomi — Verification Matrix

**Status:** canonical. What evidence each requirement must have before it can be
called done.

**The rule: per JOURNEY, not per test count.** Optimise for behaviour protection, not
for the number. A repository with 605 tests and 13 skipped suites is worse than one
with 400 tests and zero skips, because the skips are invisible in the count.

## The six cells

Every MVP journey must have all six non-empty before it is MVP-complete
([MVP.md](../MVP.md)).

| Cell | What it proves | What it is *not* |
|---|---|---|
| **Unit** | a pure rule holds (validation, ranking, cursor codec) | a function that was called and returned |
| **Integration** | it holds against a real database / real object storage | a mocked repository |
| **Runtime/API** | the real route answers the real status | a handler called with a fabricated `Request` |
| **Browser** | a person can complete the journey, and cannot see a broken state | a screenshot; a `page.tsx` that renders |
| **Negative** | bad input, wrong state, and forbidden access are refused | an error path that merely exists |
| **Isolation** | reader A never reaches reader B's row | a test that "looks scoped" |

## Matrix

| Requirement / journey | Unit | Integration | Runtime/API | Browser | Negative | Isolation |
|---|---|---|---|---|---|---|
| J-01 Register | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| J-02 Sign in | ✅ | ✅ | ✅ | ⛔ | ✅ | — |
| J-03 Search | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | n/a |
| J-04 Discover | ✅ | ✅ | ✅ | ✅ | ✅ | n/a |
| J-05 Open manga | ✅ | ✅ | ✅ | ✅ | ✅ | n/a |
| J-06 Read a chapter | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | n/a |
| J-07 Navigate chapters | ⛔ | ⚠️ | ⛔ | ⛔ | ⛔ | n/a |
| J-08 Deep-link a page | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | n/a |
| J-09 Resume | ⚠️ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| J-10 Progress persists | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⚠️ |
| J-11 Mark unread | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| J-12 Library | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| J-13 Bookmarks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| J-14 History | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| J-15 Settings | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| J-16 Delete account | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| J-17 Add a manga | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| J-18 Add chapters | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| J-19 Page guard | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Progress LWW / sticky-OR | ✅ | ✅ | ✅ | ⛔ | ✅ | ✅ |
| Media delivery | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Boundary rules (D1–D8) | ✅ | — | — | — | ✅ | — |
| No stub data | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Claims accuracy | ✅ | — | — | — | ✅ | — |

Legend: ✅ present · ⚠️ present but insufficient · ⛔ absent · — not applicable

**Read this as the real scoreboard.** Search (J-03) has three cells; the reader's
correctness story (J-10) has a correct repository and a route that does not use it.

## Test classification

| Class | Count | What it is | Policy |
|---|---|---|---|
| **Meaningful regression** | growing | Exercises shipping code, fails on a real defect | **Protect.** Keep the mutation discipline. |
| **Superficial / source-string** | ~3 files | Claim checkers, boundary self-test, traceability | **Keep.** They guard a real invariant (no stub data, no illegal import) that no behavioural test can see. |
| **Dead / unexecuted** | **13 suites skipped** | Asserts that never run | **F-023**: each gets a task ID or is deleted. A skip is a hole, not a pass. |
| **Duplicate** | unknown | Two tests, one behaviour | Do not add. Deprioritise. |

Current shape: 51 files, 605 tests, 0 failing, **13 skipped**.

## Mutation discipline

A test that has never been shown to fail is a witness, not a net. For each new
persistence or isolation behaviour, inject the mutation and record what caught it.

Performed so far — `tests/integration/members-surface.test.ts`, 15 tests:

| Injected mutation | Tests failed | Caught by |
|---|---|---|
| Remove the `userId` filter from `LibraryRepository.list` | **3** | cross-reader isolation |
| Remove the `userId` filter from `BookmarkRepository.delete` | **2** | THREAT T-04 |
| Restore `::bigint` in the history cursor | **1** | cursor pagination |

Required by slice:

| Slice | Mutation that must be caught |
|---|---|
| F-010-S1 | Break the A–Z/id tie-break; break the band order |
| F-006-S1 | Restore `completed: progress.completed` — the P0 must fail against `7af4e6a` |
| F-006-S1 | Remove the `last_read_at` touch |
| F-008-S1 | Make `unsetCompleted` reuse the sticky `saveProgress` path — it must not clear |
| F-009-S1 | Return `null` from `resolveCaller` — the Continue assertion must fail |
| F-001-S1 | Make `getOrCreateDb` non-memoised — the pool-count test must fail |
| F-022-S1 | Remove the `NODE_ENV` pin — the production-shell run must show phantom failures |

## A test that fails against the current tree is a specification, not a nuisance

For each of these, the test must be written **and observed to fail** before the fix
lands. A test that passes both before and after proves nothing.

| Slice | Test that must fail against `7af4e6a` |
|---|---|
| F-006-S1 | reading past the end of a completed chapter leaves `completed = true` |
| F-006-S1 | `library_entry.last_read_at` is set after a reader save |
| F-009-S1 | a signed-in caller populates `continueReading` |
| F-007-S2 | `?page=999` clamps to `pageCount` |
| F-011-S1 | an oversized `q` is refused before any query runs |
| F-001-S1 | one members' request opens one pool, not three |
| F-022-S1 | `NODE_ENV=production` produces zero phantom failures |

## What is deliberately not verified this way

- **Performance budgets** (NFR-PERF-014) — a catalog-perf e2e spec exists but
  never runs in CI (F-021). Not claimed.
- **Cross-browser / a11y depth** — `shell-a11y` and `catalog-a11y` exist, are not
  in CI, and cover only the catalog. The Batch 2 pages were checked by hand and by
  a mutation-proven suite; a long-term axe gate is F-021 work.
- **Anything requiring a registration journey.** Deferred with auth. Seeding a
  account and signing in is the substitute, and it is enough for every member
  surface — but a claim of "the reader journey works" must name that the account was
  seeded, not registered.
