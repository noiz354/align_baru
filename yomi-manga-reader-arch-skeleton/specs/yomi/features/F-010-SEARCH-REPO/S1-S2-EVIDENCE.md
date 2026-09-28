# F-010-S1+S2 — ACCEPTANCE: the search repository

S1 and S2 land in ONE commit, deliberately. They are one file and one query: the
four bands, the related resolution and the CJK guard cannot be built or tested
apart without writing the query twice, and a split would manufacture two
commits whose only difference is a `WHERE` clause. The checklist marks both;
this evidence covers both.

## A1 — The query

One composed statement: nine UNION ALL branches, each carrying an integer
`rank`, deduplicated by `(kind, id)` keeping the best rank, ordered by rank,
folded title, id, with a row-comparison keyset cursor on exactly those keys.

Bands best to worst (FR-SEARCH-004): exact → prefix (`ILIKE 'q%'`) → contains
(`%` similarity OR `ILIKE '%q%'`) → related (creator/tag rows plus the manga rows
resolved through the joins). Scores 400/300/200/100 are the band weights as
integers, higher is better.

- [x] 4 bands in order, asserted on a fixture that hits all four at once
- [x] A–Z folded then id within a band — byte-identical titles, ordered by id
- [x] keyset cursor: page 1 + page 2 reconstruct the full order, no overlap
- [x] creator AND tag rows plus their manga rows, all in the related band
- [x] 1–2 CJK code points take the prefix path only; 3 take the full query
- [x] drafts and soft-deleted titles never appear; hostile `q` is inert

## A2 — Four things the code or the tests corrected

**Bound parameters in a UNION default to text.** `rank` and `score` came back as
strings, so every row mapped to band `'related'` and thirteen tests failed at
once. The fix is `::integer` in SQL on all nine branches. A `LIKE '%%'` is the
same class of mistake one level up, which is why an empty `q` answers "nothing"
at this level rather than "everything".

**The fixture was wrong about its own tag.** It named the tag 'SpiralQuest',
which CONTAINS 'spiral' — so a `q` of 'spiral' legitimately matched the tag, and
the assertion that no tag hit could exist was false. Renamed to 'QuestMark'. A
fixture that cannot distinguish the behaviour it claims to test is not a fixture.

**Removing the tie-break is a mutation no database notices.** Postgres's physical
order coincides with the id order here, so deleting `, b.id ASC` changes nothing
observable. The meaningful mutation is REVERSING it, which flips the twins and
fails. Recorded because "the mutation passed" would otherwise read as "the test
is weak", when the truth is that the weaker mutation is unobservable by
construction.

**The claims checker caught the inventory outliving the code.** Landing
`search.repository.ts` contradicted `PLANNED_REPOSITORIES`, which still listed
`'search'` — and `check-claims.mjs` failed the build on it, exactly as designed.
The entry is removed.

## A3 — Mutations

| Injected | Result |
|---|---|
| the band order reversed (related best) | **5 tests fail** |
| the id tie-break reversed | 1 test fails |
| the CJK gate forced open | 1 test fails |
| the visibility filter replaced with `TRUE` | **6 tests fail** |
| the LIKE escape removed | 1 test fails |

## A4 — Gates

- [x] 690 → **711 passed (711)** (21 new)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles

## A5 — What is NOT claimed

- The service, route and page (F-011/F-012). This is rows, bands, cursor, silence.
- The 400ms budget (T-SEARCH-005 load test). The EXPLAIN gate proves the index is
  used; the budget is measured, not asserted here.
- `score` beyond the band weight. There is no per-row relevance score, by design:
  within a band the order is A–Z then id, and inventing a finer score would be a
  second ranking nobody specified.

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-010-S1+S2 |
| Files | `server/db/repositories/search.repository.ts` (new), 1 test, `PLANNED_REPOSITORIES` trimmed |
| Tests | +21 |
| Mutations | 5 of 5 caught (the tie-break mutation is the reversal, for the reason above) |
| Commands | 6 mutations · full regression gates · `next build` |
| Notes | The flagship non-auth track is open. A one-row fixture passes every band test there is, because with one row every order is correct — so the fixture is built to break ordering. |
