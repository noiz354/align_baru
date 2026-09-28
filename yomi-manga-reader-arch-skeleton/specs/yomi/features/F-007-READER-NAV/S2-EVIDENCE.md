# F-007-S2 — ACCEPTANCE: the `?page=N` deep link

## A1 — The gap and what fixes it

The reader's server shell read `params` and nothing else, so page state always
initialised to 1. `/bookmarks` builds the contract-correct `?page=N` href
(EC-RDR-06) and it landed on page 1 — a link built correctly that goes to the
wrong place, which is worse than no link because it looks right.

- [x] the shell reads `searchParams` and hands a parsed value to the client
- [x] the client prefers the deep link over saved progress, and only fetches
      progress when there is no deep link
- [x] clamping to `[1, pageCount]` happens in the client, where `pageCount` is known
- [x] the shell contains no clamp, and the test asserts that absence

## A2 — Two decisions, both argued in the code

**A deep link beats saved progress.** Someone who followed a link to page 12 asked
for page 12. Substituting their last position would make the link lie, and a link
that lies cannot be shared. Progress is only the starting point when there is no
deep link — which also means the deep-link path skips a pointless round trip.

**A page past the end is clamped, not refused.** `?page=999` in a 12-page chapter
is a stale bookmark, not an attack. Landing on the last page is a useful answer; a
422 would be a dead end with no way forward.

## A3 — Where the code lives, and why

The two pure functions are in `src/features/reader/deep-link.ts`, not beside the
route. Two reasons: it is domain logic (a rule about what a page number in a URL
may mean) and `features/` is where rules live; and **a test cannot import it from
the route directory at all** — those paths contain `[slug]` and `[chapter]`, which
are not valid module-specifier characters, and this project has no `paths` mapping
to route around it. The first attempt at the test could not resolve the module.

The first version also used `new URL(..., import.meta.url)` with the bracketed path
and silently found nothing, because square brackets are not valid URL characters
either. Both failures are recorded in the module header.

## A4 — Coercion is `Number()` on purpose

`' 5 '` → 5 and `'1e3'` → 1000. A first version of the test asserted both were
refused, and they are not. Accepting them is the right call: a stray space almost
certainly means page 5, and 1000 is pulled back to the last real page by the clamp.
A strict `^\d+$` would be tidier on paper and worse in use. `?page=0`, `-1`, `abc`,
``, `1.5`, `NaN`, `Infinity` and a repeated `?page=1&page=2` all read as "no deep
link".

## A5 — Mutations, and a harness that lies

| Injected | Result |
|---|---|
| deep link loses to saved progress | **1 test fails** |
| `clampRequestedPage` stops clamping | **2 tests fail** |
| parser accepts `page <= 0` | **2 tests fail** |
| shell stops reading `?page=` | **1 test fails** |

**Two of these initially "passed" and both were my fault, not the code's.**

1. The clamp mutation replaced `return Math.min(requestedPage, pageCount)`. The
   parameter is `requested`, so the replacement **never applied** — the file was
   unchanged and the suite was correctly green. This is the second time today a
   mutation silently did nothing. The harness now prints whether it applied and
   exits non-zero if it did not, so an unapplied mutation is impossible to read as
   a pass.
2. The precedence mutation had **no test at all** — neither the wiring nor the
   behaviour was covered, so disabling the branch changed nothing observable. The
   client-side branch is now asserted in `reader-navigation.test.ts` and the shell
   wiring in `reader-deeplink.test.ts`, each labelled as the source-level check it
   is.

## A6 — What is not covered

The arithmetic is unit-tested. The wiring is source-asserted. **That the reader
actually lands on the page is not verified** — that is browser work, and neither
test claims it.

The URL is also not rewritten as the reader moves between pages. That is
deliberate: a `history.push` per page would make the reader's Back button step
back through every page they viewed, and a `replace` would fight the browser's own
behaviour. The address reflects the chapter, the deep link is honoured on entry,
and that is the contract.

## A7 — Gates

- [x] 625 → **638 passed (638)** (13 new)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-007-S2 |
| Files | `features/reader/deep-link.ts` (new), reader `page.tsx`, `reader-client.tsx`, 2 tests |
| Tests | +13, 0 removed |
| Mutations | 4 of 4 caught — after fixing one that never applied and one with no test |
| Commands | the four mutations · full regression gates · `next build` |
| Notes | The deep link now works end to end, which is what the `/bookmarks` jump link was always claiming to do. |
