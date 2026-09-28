# F-024 TRACEABILITY — SPEC

## User problem

Four shipped files carry no traceability header, and one carries a header that
states something false. AGENTS.md §4.2 makes requirement + task ids a review gate
for new code, so a file without one reads as either pre-standard or exempt, and
there is no way to tell which.

The consequence is not paperwork. A reader of
`app/api/v1/chapters/[chapterId]/pages/route.ts` is told it is a "Minimal wave2
implementation" — a phrase that reads as intentional — when in fact it opens its
own database handle per request and reads through a file scheduled for deletion.
The header actively conceals a defect.

## Current implementation

| File | State |
|---|---|
| `app/manga/[slug]/chapter/[chapter]/page.tsx` | **no header at all** |
| `app/manga/[slug]/chapter/[chapter]/reader-client.tsx` | **no header at all**; its only task id anywhere is `T-UPLOAD-004` at `:156`, inside an image-failure state |
| `app/api/v1/chapters/[chapterId]/pages/route.ts` | 3-line header, no requirement ids, no task id, and the self-description is misleading |
| `app/api/auth/login/route.ts` | **no header at all** |
| `app/api/auth/logout/route.ts` | **no header at all** |
| `app/manga/[slug]/page.tsx:41-44` | states `continueReading` "is not in the parsed contract yet" — **false**; `catalog-schema.ts:98` parses it and the page consumes it at `:142` |

## Required behaviour

Every one of these files states, in its own header, what it is, which requirements
and tasks it belongs to, and — where it has a known gap — what that gap is and
which slice closes it. No file may describe itself in a way that makes a defect
look intentional.

## Scope

Comments only. No behaviour, no signature, no import.

## Non-goals

- Not fixing any of the gaps the headers now name. F-006-S1, F-007-S1, F-007-S2,
  F-009-S1 and F-005 own those.
- Not adding headers to every file lacking one. Five files, the ones with no
  traceability at all or with a false statement.
- Not inventing task ids. Every id used is verified present in `TASKS.md`.

## API / UI / persistence / schema changes

None. Zero lines of logic change — asserted mechanically, see
[ACCEPTANCE.md](ACCEPTANCE.md).

## Authorization

Not applicable.

## Error behaviour

None changed.

## Edge cases

| Case | Handling |
|---|---|
| The codebase uses both `Task:` and `Tasks:` | 48 and 95 occurrences respectively; both accepted. A gate must follow the convention in the tree, not impose a new one. |
| A file has no H1 to insert after | Header is prepended; `page.tsx` and the two auth routes had none at all |
| A header would claim more than is true | It names the gap instead. `reader-client.tsx` now states that `readingDirection` is shown as text and never applied — true, and previously unstated. |
| A gap is fixed later | The header's `→ F-XXX` marker is what makes it findable |

## Affected files

Six files, all comments.

## Dependencies

None. Parallel-safe with F-020, F-022, F-023.

## Acceptance criteria

See [ACCEPTANCE.md](ACCEPTANCE.md).

## Rollback concern

None. Comment-only.
