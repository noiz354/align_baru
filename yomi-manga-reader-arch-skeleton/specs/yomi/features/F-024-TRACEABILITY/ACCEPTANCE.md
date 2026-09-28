# F-024 TRACEABILITY — ACCEPTANCE

## A1 — Every file has a header naming its requirements and tasks

- [x] `app/manga/[slug]/chapter/[chapter]/page.tsx`
- [x] `app/manga/[slug]/chapter/[chapter]/reader-client.tsx`
- [x] `app/api/v1/chapters/[chapterId]/pages/route.ts`
- [x] `app/api/auth/login/route.ts`
- [x] `app/api/auth/logout/route.ts`

Verified: `grep -L -E "^ \* Tasks?: T-"` over the five returns nothing.

**The check accepts `Task:` and `Tasks:`** because the tree uses both (48 and 95
occurrences). A gate that only accepted one would have failed four correct
headers.

## A2 — The misleading self-description is gone

- [x] "Minimal wave2 implementation" no longer appears in
      `app/api/v1/chapters/[chapterId]/pages/route.ts`
- [x] the replacement says plainly that the route bypasses the architecture, that
      this is a known defect, and that F-006-S2 removes it

## A3 — The false comment is corrected

- [x] `app/manga/[slug]/page.tsx` no longer claims `continueReading` is unparsed
- [x] the replacement states it IS parsed and consumed, and that the real gap is
      `app/api/v1/_runtime.ts`'s resolver returning `null` — citing the old claim
      explicitly so a reader who remembers it knows why it changed

## A4 — Headers state gaps rather than omitting them

- [x] `page.tsx` names: no `?page=N`, no chapter nav, no route protection, and the
      progress save that erases completion
- [x] `reader-client.tsx` names: no chapter nav, no `?page=N`, `readingDirection`
      shown but not applied, a `fetch` with no `.catch` that discards a 401
      silently, and the P0 write path
- [x] the login route names: no `users` insert exists, argon2 imported ad-hoc,
      session storage bypassing the port, a third connection per request
- [x] the logout route names: matching cookie attributes, the same two debts, and
      that `revokeAll` has no caller

## A5 — Comment-only, proven

- [x] `git diff -U0` filtered to non-comment, non-`Task:` lines produces **zero**
      lines across all six files
- [x] 605 tests still pass; `next build` compiles
- [x] tsc 0, eslint clean, boundaries 7/7 + control, claims pass

## A6 — No unrelated formatting churn

- [x] exactly one file was newly prettier-dirty by this change
      (`app/manga/[slug]/page.tsx`) and was formatted
- [x] the four files already prettier-dirty at HEAD were left as found rather than
      reformatted, so the diff stays comments-only

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-024-S1 (this commit) |
| Files | 6, comments only — 138 insertions, 6 deletions, **0 logic lines** |
| Tests | 605 passed / 0 failed |
| Commands | `grep -L -E "^ \* Tasks?: T-"` over the 5 files · `git diff -U0` filtered · full regression gates · `next build` |
| Notes | Two corrections to the plan itself: the route path is `chapters/[chapterId]/pages`, not `[id]`; and the traceability gate must accept both `Task:` and `Tasks:` because the tree uses both. |
