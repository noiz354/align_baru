# F-007-S1 — ACCEPTANCE: previous/next chapter in the reader

## A1 — The gap was real and is closed

`ChapterRepository.pageList` has returned `prevChapter`/`nextChapter` since
FR-READER-016 was implemented, and the `/pages` route has returned them since
F-006-S2 rewired it. The reader declared its **own local**
`ChapterPagesResponse` without those two fields, so the response carried them and
the client dropped them.

- [x] the client imports `ChapterPagesResponse` and `PageAsset` from
      `shared/contracts/chapter`
- [x] both local redeclarations are gone — the drift that made the bug invisible
- [x] `readNeighbour` guards three things: a non-object, a non-string/empty slug,
      a non-finite number. All three collapse to `null` (no neighbour)
- [x] a `<nav aria-label="Chapter navigation">` renders a real `<a href>` per
      neighbour, each with an `aria-label` naming the chapter
- [x] absence renders "No previous chapter" / "No next chapter" rather than a
      dead control
- [x] the header no longer lists chapter navigation as a gap

## A2 — Why links, not a router push

A `<button>` with `router.push` is keyboard-reachable but not middle-clickable,
not openable in a new tab, and not copy-linkable — all of which a reader expects
from "the next chapter", and all of which a plain `href` gives for free. It also
keeps one chapter per address, so the reader's own Back button tells the truth.
`useRouter` is therefore not imported.

## A3 — Mutations

| Injected | Result |
|---|---|
| restore the local `ChapterPagesResponse` (the original defect) | **1 test fails** |
| point the next-chapter href at `#` | **1 test fails** |
| remove the raw-object guard in `readNeighbour` | **1 test fails — only after the test was fixed** |

The third one is the honest note of this slice. The first version of the test
asserted two of `readNeighbour`'s three guards and the mutation removing the third
**passed**. That guard is the one preventing a *throw* rather than a wrong value:
without it, a response that omits `prevChapter` entirely indexes `undefined`. The
gap was found by running the mutation, and the assertion was added.

## A4 — A test bug, recorded

The final assertion looked for `F-READER-016`, which is a substring of **neither**
`T-READER-016` nor `FR-READER-016`. It failed against a header that was correct.
The header convention here is `Task:`/`T-…` and `Requirements:`/`FR-…`, and the
test now asserts both real forms.

## A5 — Why this test reads source instead of mounting

A React test would need a DOM, a router, a fetch stub and a full chapter fixture,
and would still be asserting markup. What is actually at risk is a **shape
mismatch** between the contract the server sends and the type the client parses —
a question about two declarations agreeing, which the test checks directly. A
field added to the contract and forgotten in the client now fails the build.

**Not covered, and not claimed:** that clicking a link actually navigates. That is
browser work. The href is asserted; the navigation is not exercised.

## A6 — Left in place, deliberately

The reader renders a `Debug` panel and a "reload or restart to verify" line to
readers. Both are developer text in a user-facing surface, and both are named in
the client header as a recorded gap rather than fixed here — folding an unrelated
cosmetic change into a navigation commit would make this commit about two things.

## A7 — Gates

- [x] 618 → **625 passed (625)** (7 new)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-007-S1 |
| Files | `reader-client.tsx`, `tests/integration/reader-navigation.test.ts` |
| Tests | +7, 0 removed |
| Mutations | 3 of 3 caught (one only after the test was corrected) |
| Commands | the three mutations · full regression gates · `next build` |
| Notes | The test's own path resolution had to change: the reader's directory contains `[slug]` and `[chapter]`, which are not valid URL characters, so `new URL(..., import.meta.url)` silently fails to find the file. The first version of the test never loaded. |
