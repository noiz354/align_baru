# Spec questions — open findings and their resolutions

Created: 2026-09-27 · Author: reconciliation of the VS-1 catalog slice

This file is the register AGENTS.md §6 asks for ("record an open question in the
task's PR, tag `spec-question`") in a form that survives the PR. Each entry
states the contradiction with `file:line`, the authority it was resolved
against, the decision, and what follows from it. Nothing here is a preference:
where the documents disagreed, the more authoritative one won (PRD > ADR >
docs) and the losing statement is named.

An entry is **OPEN** when the decision needs the document owner's sign-off, and
**RESOLVED** when the code and the documents already agree with the decision.
The follow-up work (doc amendments, spec-fix tasks) is named per entry.

---

## SQ-CAT-1 — Is `chapter.reading_order` derived or admin-managed?

**Status: RESOLVED (code unchanged; two documents need amending)**
**Tags: spec-question, spec-fix**

### The contradiction

| Source | Says |
|---|---|
| `DATA_MODEL.md:130` | `reading_order integer NOT NULL` — "(explicit tiebreaker, FR-CHAPTER-004)" |
| `docs/product/admin-workflow.md:30` | "`reading_order` assigned on create (**max+1**); renumbering is not a v1 feature (manual `reading_order` edits are P2, out of PRD scope)" |
| `TASKS.md:1107` (chapter admin task) | "reading_order assigned on create (**max+1**), renumbering not in v1" |
| `PRD.md:94` (FR-CHAPTER-004) | "Chapter order within a manga is deterministic (**by number**, with an explicit sort tiebreaker) and stable across reads." |
| `src/server/db/repositories/chapter.repository.ts:506` | writes `readingOrder: (number::numeric * 100)::int` |
| `src/server/db/repositories/chapter.repository.ts:240` | sorts `.orderBy(chapter.readingOrder)` |

Two separate questions were tangled together, which is why this looked
ambiguous:

1. **Who supplies the value?** Not ambiguous. `admin-workflow.md:30` and
   `TASKS.md:1107` both say the admin never edits it in v1, so it is **derived at
   write time, not admin-managed**. `DATA_MODEL.md:130`'s "explicit tiebreaker"
   means "a stored column rather than an expression evaluated at read time" —
   which is compatible with derivation, not a claim that an admin types it.
2. **What is the derived value?** Genuinely contradictory: the two product docs
   say `max+1`, the code says `number × 100`.

### The decision

**Derived, never admin-edited — and the derivation is `number × 100`, so the two
documents that say `max+1` are the ones that are wrong.**

- `max+1` encodes **insertion** order, not number order. Insert chapter 5, then
  chapter 3: `5` gets order 1 and `3` gets order 2, so the list renders 5 before
  3 while `number` — the value the reader sees — says otherwise. The index at
  `DATA_MODEL.md:131` is `UNIQUE (manga_id, reading_order)`, so this is not a
  theoretical ordering; it is the order the page shows.
- `max+1` also costs a `MAX(reading_order)` read on every insert, which is
  racy under concurrent admin writes, to compute a value the row already
  determines.
- `number × 100` is **injective for every legal value**: `number` is
  `numeric(8,2)` (`src/server/db/schema.ts:358`), i.e. at most two decimals, so
  scaling by 100 maps distinct legal numbers to distinct integers and
  `UNIQUE (manga_id, reading_order)` can never collide. It needs no extra query.
- With that derivation, `ORDER BY reading_order` is **equivalent to
  `ORDER BY number`** for all legal data, so `PRD.md:94` ("by number, with an
  explicit sort tiebreaker"), `TASKS.md:259` ("Ordered by `reading_order`") and
  the implemented sort stop contradicting each other. Note that
  `(manga_id, number)` is UNIQUE (`DATA_MODEL.md:129`), so the tiebreaker is
  never actually *needed* for correctness — `reading_order` exists so the
  hot-path index at `DATA_MODEL.md:131` has something to serve.

### What follows

- Amend `docs/product/admin-workflow.md:30` and `TASKS.md:1107` to name the
  `number × 100` derivation instead of `max+1`. **No code change.**
- Carry-forward caveat: the ×100 derivation is only injective because of
  `numeric(8,2)`. If chapter numbers ever need more decimals, this must be
  revisited before the schema changes — otherwise the unique index starts
  throwing on legal input.

---

## SQ-CAT-2 — A genre has no `slug` column, but the filter carries "genre slugs"

**Status: RESOLVED (no schema change; a real defect was found and fixed)**
**Tags: spec-question, defect, spec-fix**

### The apparent gap

`DATA_MODEL.md:100-102` gives a genre `id`, `name`, `created_at` and a unique
index on `name` — there is no `slug` column. But `API_CONTRACT.md` §2.1
describes the catalog filter as a csv of "genre slugs"
(`?genre=action,drama`), and `TASKS.md:259`-adjacent task text (T-CATALOG-004)
sends `genre.name` values. So the contract speaks in slugs and the schema has
only names.

### The decision

**No `slug` column. The slug is DERIVED, and the derivation has to be identical
on both sides of the wire.** A column would be a second identity for a
controlled vocabulary only an admin can create — permanent maintenance burden
(slugify collisions on rename, backfill on every new genre) for no functional
gain, since the vocabulary is ~20 rows and `ix_genres_name` already covers it.

The service derives it in TypeScript (`normaliseGenreSlug`,
`src/features/catalog/catalog.repository.ts`); the query must derive the same
value in SQL.

### The defect this uncovered — a filter that lied

The two sides did **not** agree, and the disagreement was invisible:

- The **product** repository (`resolveGenreIds`, previously
  `src/server/db/repositories/manga.repository.ts`) compared
  `lower(genre.name)` against the incoming slug. For a single-word genre those
  are the same string. For a multi-word genre they are not: `Slice of Life`
  slugifies to `slice-of-life`, and no `lower(name)` equals that.
- When no genre resolves, the contract says an unknown filter value is
  **ignored** — so the genre predicate was dropped entirely and
  `GET /api/v1/catalog?genre=slice-of-life` answered with **the whole catalog**.
  Measured on real PostgreSQL 18: 34 rows returned where 1 was expected. A
  filter that returns everything is worse than one that returns nothing.
- The **test harness** had its own copy of the rule, slugifying in SQL
  (`regexp_replace(lower(btrim(name)), '[^a-z0-9]+', '-', 'g')`). Every
  genre-filtered behaviour test therefore ran a query the application never
  executes. The EXPLAIN gate did build the product statement, but a plan
  assertion cannot notice that a query matches no rows.

Fixed by making the rule a single exported definition,
`genreSlugSql()` at `src/server/db/repositories/manga.repository.ts:486`, which
the harness now imports instead of re-implementing. `INT-CAT-004`
(`tests/integration/catalog-genre-filter.test.ts`) drives the **product**
repository over real rows, including the end-to-end journey
`?genre=Slice of Life` → service normalisation → repository.

### What follows

- Amend `API_CONTRACT.md` §2.1's genre row to state that the filter value is the
  name-derived slug, and to name the rule, so the next reader does not have to
  rediscover it in two languages.
- **Documented limitation, no change:** the rule is `[a-z0-9]`-only, so a genre
  whose name is entirely non-latin has a degenerate (empty) slug and **cannot be
  filtered**. Both sides drop such a token consistently — the service at the
  edge, the query to `''` — so the behaviour is "not filterable", not "silently
  unfiltered". If product needs it, `DATA_MODEL.md` §6 must gain a slug column
  and this entry is reopened.

---

## SQ-CAT-3 — `ChapterPageRecord.id` is not a column in DATA_MODEL §10

**Status: RESOLVED (code unchanged; one line of DATA_MODEL needs amending)**
**Tags: spec-question, spec-fix**

### The contradiction — it is inside a single section

`DATA_MODEL.md` §10 contradicts itself:

| Line | Says |
|---|---|
| 140 | "**PK:** `id uuid`." |
| 142 | "**Uniqueness:** `(chapter_id, page_number)` unique" |
| 143 | Columns are `chapter_id`, `page_number`, `asset_key`, `width`, `height`, the three `byte_size_*`, `created_at` — **no `id`** |
| 144 | "**Indexes:** PK `(chapter_id, page_number)`" |

So the section declares a surrogate primary key and then describes a composite
one three times. Meanwhile `src/server/db/schema.ts:407` implements
`primaryKey({ columns: [t.chapterId, t.pageNumber] })`, and
`src/server/db/repositories/chapter.repository.ts:185` builds the DTO's `id` as
`` `${chapterId}:${pageNumber}` ``.

### The decision

**The composite `(chapter_id, page_number)` IS the primary key;
`DATA_MODEL.md:140` is the error.** Three of the four statements in §10 agree
with each other, and they also agree with the schema, the migration and the
query plans. A surrogate `id uuid` would also buy nothing: `ix_pages_asset_key`
is already unique, and no query needs an opaque page key that the composite
does not provide.

The DTO's `id: string` **stays**. It is the real key rendered deterministically,
not an invented identifier — which is exactly what the reader's page addressing
and the re-ingest path need, and it removes any need for a column that exists
only to be looked up.

### What follows

- Amend `DATA_MODEL.md:140` to "**PK:** composite `(chapter_id, page_number)`".
  **No code change.** The comment at
  `src/server/db/repositories/chapter.repository.ts:175-184` already records the
  open question and should be updated to point here once the amendment lands.
---

## SQ-A11Y-1 — On a document load, does a boundary state take focus or announce politely?

**Status: RESOLVED (code changed; two E2E specs reframed, no product behaviour lost)**
**Tags: spec-question, a11y, spec-fix**

### The contradiction

Two specs asserted opposite things about the same page, and neither was wrong
about its own text — which is why it stayed invisible:

| Source | Asserts |
|---|---|
| `tests/e2e/shell-a11y.e2e.spec.ts` (not-found) | on a hard load, `document.activeElement` IS the `.focus-region` |
| `tests/e2e/route-map.e2e.spec.ts` (every route) | on every route, the first `Tab` focuses the skip link |
| `ACCESSIBILITY.md §6` / NFR-A11Y-003 | error/empty states are "focusable, announced, and offer a next action" |
| `ACCESSIBILITY.md §4` / NFR-A11Y-002 | the skip link is the first focusable element on every page |

On a hard load of the 404 page these cannot both hold. `FocusRegion` focused on
every mount, and the region sits AFTER the skip link in the DOM, so the first
`Tab` moved forward from the error body and the bypass link could never be
reached (WCAG 2.4.1). Measured in the browser: `activeElement` was the
`div.focus-region` at DOM index 39, while `a.skip-link` sat at index 20 and was
focusable #1.

### The decision

**Split by moment, because the two requirements are about different moments.**

- **HARD document load** (`page.goto`, a pasted URL, a refresh): do NOT move
  focus. The reader has no in-app context to reorient and the bypass link is the
  first thing they should reach. The state is still ANNOUNCED, through a
  `role="status"` wrapper — which is what §6 actually asks for.
- **IN-APP navigation** (a client-side transition into an error state): DO move
  focus. The reader triggered the change, the bypass link has already done its
  job, and moving focus is how a state change is announced.

Both branches keep `tabIndex={-1}` and the label, so the region stays
programmatically **focusable** — §6's "focusable" is not the same claim as
"focused", and nothing is lost.

The two moments are told apart by `src/shared/ui/hydration.tsx`: a marker in the
ROOT LAYOUT sets a module flag at first hydration, and `FocusRegion` reads it
during render. React runs child effects before parent effects, so on a hard load
a `FocusRegion` deeper in the tree still sees `false`; on a soft navigation the
layout's effect has already run. One boolean, no router internals.

### What follows

- `FocusRegion` rewritten; `hydration.tsx` added; the root layout mounts the
  marker. Both E2E specs that encoded the old reading are reframed onto the
  per-case contract, and both say why in place.
- **Coverage honesty:** the in-app-navigation branch is NOT covered end to end.
  A plain `<a href>` click is a full document navigation, and the app exposes no
  in-app link whose target 404s — exercising it would mean adding a link that
  exists only for the test. The branch is guarded by `hasHydrated()`; the branch
  that was broken, and that a reader hits by pasting a URL, is covered.
- T-CATALOG-013 carries the document-side amendments this round produces.

