# F-008-S1 — ACCEPTANCE: `unsetCompleted`, the operation that did not exist

## A1 — The defect

`LibraryService.setReadStatus(caller, chapterId, false)` read the progress row and
wrote `completed: existing.completed` straight back through `saveProgress`:

```ts
const existing = await readerProgress?.getProgress(userId, chapterId);
if (existing === null || existing === undefined) return;
await readerProgress?.saveProgress(userId, { …, completed: existing.completed });
```

`saveProgress` is sticky-OR by contract — `SET completed = reading_progress.completed
OR excluded.completed` — so the value written back was always the value already
stored. A guaranteed no-op, recorded as SQ-LIB-7 so it read as a decision rather
than a mistake. A documented no-op is the worst kind of bug: nobody re-reads
decisions, so nothing ever challenged it.

- [x] `unsetCompleted(userId, chapterId)` on the port and the repository
- [x] its own statement and its own LWW guard — not a flag flip through `saveProgress`
- [x] sticky-OR preserved for `saveProgress`; the two paths do not interfere
- [x] `setReadStatus(false)` calls it, and SQ-LIB-7 is closed
- [x] unsetting a chapter with no progress row is a safe no-op, not a throw
- [x] unsetting another user's row changes nothing, proven by test
- [x] the zero-caller status is resolved — see A5

## A2 — The sticky-OR stays

`saveProgress` is untouched. The sticky flag is what stops a stale page write from
un-finishing a chapter, and a reader who has finished chapter 4 should not be able
to lose that by clicking page 12 on a lagging tab. Clearing the flag is a different
intent expressed by a different person at a different moment, so it is a different
operation. One test asserts the structural fact directly: routing the unset through
`saveProgress({ completed: false })` leaves the flag `true`.

## A3 — Scope, and the decision inside it

`unsetCompleted` clears `completed` and nothing else. `pageNumber` and
`scrollPosition` are left alone, so "unread" means "not finished", not "start
over" — the resume rules still point at the stored page. A reader marking a
chapter unread is asking to re-read it, not to forget where they were, and
silently rewinding would destroy a position they may want. Rewinding is a
different decision with a different cost and is not implied; a mutation that
adds `pageNumber: 1` is caught, so the narrow scope cannot erode quietly.

Also pinned by test: the no-op rule (`AND completed = true`, which is what makes a
repeat idempotent and stops `updated_at` churning), one-chapter scoping (a sibling
chapter of the same title is untouched), and the LWW guard (a row stamped in the
future — what a stale writer looks like — is not un-finished).

## A4 — The zero-caller problem, and why the route is not an auth violation

`setReadStatus` was complete, wired to two ports, and called by nothing. A service
method with no caller is not a feature that is merely unexposed; it is a method
whose behaviour nothing has ever observed — and the one place it had been
exercised was the no-op above.

The checklist required wiring or deleting. Deleting a correct operation would
throw away the only unset path NFR-DATA-003 requires, so
`POST /api/library/chapters/{chapterId}/read-status` was added.

**This is not the auth-deferral violation.** The deferral rule is that ADMIN and
UPLOAD work must not be exposed before F-005, because those are unguarded admin
surfaces. This is the members' `/api` lane, which already ships (`/api/library`,
`/api/bookmarks`, `/api/history`) and enforces membership per route exactly as
`library/[mangaId]/route.ts` does: `resolveCaller` answers `null` without a
session and the route answers 401. What stays deferred is the `/library` PAGE's
control, because pages are what F-005 protects.

The body's `read` must be a real boolean. `Boolean('false')` is `true` and
`Boolean(0)` is `false`, so a coercing parse would let `{"read": 0}` mark a chapter
**read** — the opposite of the intent and irreversible without a second call. A
body of `{}` means "the caller sent nothing", not "mark it unread".

## A5 — Two mistakes worth recording

**The checklist lied, and I put the lie there.** F-008-S1's boxes were all `[x]`
and its evidence block held F-007-S2's. The F-007-S2 commit's checklist edit
replaced `- [ ] ` with `- [x] ` across a range that ran past this block and carried
the wrong evidence in with it. Nothing had been implemented. The block is now
unchecked with blank evidence, and the false state is written down in it.

**A mutation harness that reports success for a mutation it did not apply.** The
`eq(readingProgress.completed, true)` predicate appears in `getCompletedSet` too,
and the harness replaced the FIRST occurrence — so a mutation meant to strip the
no-op rule from `unsetCompleted` silently edited a different function, changed
nothing, and was recorded as a pass. The opposite of the F-007-S2 failure, and the
same root cause: "the pattern was found somewhere" is not "the mutation landed
where it was meant to". The harness now refuses a non-unique pattern.

## A6 — Mutations

| Injected | Result |
|---|---|
| the original no-op restored in `setReadStatus` | **6 tests fail** |
| the LWW guard removed from `unsetCompleted` | 1 test fails |
| the no-op rule removed (repeat stops being idempotent) | 1 test fails |
| `userId` dropped from the `WHERE` (cross-user leak) | 1 test fails |
| `unsetCompleted` also rewinds `pageNumber` | 1 test fails |
| `read` parsed with a truthy check instead of a type guard | **4 tests fail** |
| the route's 401 check removed | 1 test fails |
| the route reads `chapterId` from the body | 1 test fails |
| `return Boolean(body.read)` after the type guard | no change — provably equivalent |

The last row is recorded rather than hidden: by the time `parseRead` returns, the
value is already a boolean, so `Boolean()` is identity there. The dangerous
coercion is `Boolean('false')`, and it is unreachable — the row above it is what
proves the guard is load-bearing.

## A7 — Gates

- [x] 656 → **690 passed (690)** (34 new: 11 repository, 11 service, 13 route — one overlap)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles

## A8 — What is NOT claimed

- That the `/library` page has a control. The route exists and is tested; the UI
  is deferred with F-005.
- No browser check was run for this slice: the only reachable surface is an API
  route with no UI, and the page work is deferred.

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-008-S1 |
| Files | `features/progress/reader-progress.repository.ts`, `server/db/repositories/progress.repository.ts`, `features/library/library.service.ts`, new `app/api/library/chapters/[chapterId]/read-status/route.ts`, 3 tests |
| Tests | +34 |
| Mutations | 8 of 8 caught; 1 further mutation provably equivalent and recorded as such |
| Commands | 9 mutations · full regression gates · `next build` |
| Notes | A documented no-op is the worst kind of bug. The two claims the checklist and the mutation harness made about this work were both false, and both are written down where the next person will hit them. |
