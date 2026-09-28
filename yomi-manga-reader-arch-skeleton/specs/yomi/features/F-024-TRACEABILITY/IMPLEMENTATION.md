# F-024 TRACEABILITY — IMPLEMENTATION

## Method

A Python pass per file, inserting a header at the top. Two placement rules, both
driven by what the file actually looked like:

- **No H1** (the two auth routes, `chapter/[chapter]/page.tsx`): prepend.
- **Existing block comment** (`pages/route.ts`): prepend a new block above it,
  leaving the original intact so the change is visibly additive.

`reader-client.tsx` starts with `'use client'`, which must remain the first
statement, so the header was inserted *after* the directive — a `'use client'`
that is not first is not a directive.

The `manga/[slug]/page.tsx` correction was done **by line range**, found with a
substring match, rather than by exact-string replacement. The exact match failed
on an em-dash encoding difference, and a line-range edit is the right tool for a
multi-line block containing typography regardless.

## What each header says, and why not more

A header is read by someone deciding whether to trust the file. It earns trust by
being specific about its own defects, not by being short. So each names what the
file does, then a **KNOWN GAPS** section with a `→ F-XXX` marker per gap.

That marker is the load-bearing part: it is what makes a gap findable when the
gap is fixed, and it means the header cannot quietly become false — either the
gap is closed or the marker now points at a slice that should not be open.

`reader-client.tsx` gained the detail that its save `fetch` has no `.catch`, so a
401 discards the reading position silently, and that this is invisible in
development because a seeded account can sign in. That is a real observation
about why the defect survived, and it is the kind of thing a header is for.

## Two corrections to the plan

1. The route is `app/api/v1/chapters/[chapterId]/pages/route.ts`, not `[id]`. The
   gap audit and the checklist both wrote `[id]`. Found when the file was opened
   to add a header and the path did not exist.
2. The acceptance grep was `grep -L "Task: T-"`, which reported four of five files
   as missing a header — all of which had one. The tree uses `Task:` 48 times and
   `Tasks:` 95 times. A gate that picks one spelling fails correct code; the check
   was changed to accept either, and the checklist's acceptance text with it.

## Files

| File | Change |
|---|---|
| `app/manga/[slug]/page.tsx` | stale comment corrected (4 lines → 9) |
| `app/manga/[slug]/chapter/[chapter]/page.tsx` | header added |
| `app/manga/[slug]/chapter/[chapter]/reader-client.tsx` | header added, after `'use client'` |
| `app/api/v1/chapters/[chapterId]/pages/route.ts` | "Minimal wave2" header replaced with an honest one |
| `app/api/auth/login/route.ts` | header added |
| `app/api/auth/logout/route.ts` | header added |

## Risk

Zero by construction. Verified mechanically: `git diff -U0` filtered to
non-comment lines is empty, and 605 tests plus a production build still pass.
