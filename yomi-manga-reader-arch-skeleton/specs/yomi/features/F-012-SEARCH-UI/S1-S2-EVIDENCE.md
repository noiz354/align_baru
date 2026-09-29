# F-012-S1+S2 — ACCEPTANCE: `/search` is a real page

S1 and S2 in one commit: the page and its deep-linkable URL are one piece of
work — a search box whose query is not in the URL is a different feature from
the one specified, not a first slice of it.

## A1 — What shipped

`NotYetBuilt` is gone. A server shell reads `?q=` and renders page 1 for it;
the `SearchBox` island takes over for typing (300 ms debounce, Enter forces
immediate) and paging (opaque cursor, append, focus stays). Five states, and an
error is never "no results": idle · loading · results · empty · error, with the
429 naming itself ("rate limited, wait a minute") because "retry" on a rate
limit is advice to do the forbidden thing.

- [x] result rows are links where there is somewhere to go (manga) and text
  where there is not (creator/tag — v1 has no browse page for them, so they are
  correctly non-focusable information, not broken controls)
- [x] kind badge + band hint + match-field hint are WORDS, never colour-only
- [x] the count is a live region that is always in the DOM (`aria-atomic`), and
  reports what is on screen — never a total the contract does not expose
- [x] `?q=` is shareable: pasting it renders the same first page with or without
  JavaScript; Back moves through searches (`push`, not `replace` — the
  acceptance requires it, and the debounce is what keeps history usable: one
  entry per pause, not per keystroke); clearing `replace`s the bare `/search`
  so no meaningless `?q=` is left behind; the cursor is never in the URL
- [x] a 429 on the FIRST paint renders the rate-limited state, not "unavailable":
  `readSearchPage` carries which failure the server hit
- [x] heading order, labelled input, 44 px targets via the shared `.btn`

## A2 — The acceptance corrected the implementation

A first version used `router.replace` for query updates, on the reasoning that a
query change is not a new page. The acceptance says Back moves through searches
— and the acceptance is the requirement, not the comment. `push` for queries,
`replace` only for clearing. The debounce is what makes `push` safe: without it
Back would step through letters.

## A3 — Browser verification, with the harness limits stated

Verified on `:3199` with a seeded database, in a real browser:

| Check | Result |
|---|---|
| `GET /search?q=resume` first paint | 10 results, badges, hints, links, announced count |
| result link click | navigates to `/manga/resume-a` |
| submit with a typed query | URL takes the typed `?q=` |
| `?q=` for a no-match query | empty state ("Nothing matches…"), not an error |
| Back after two searches | restores the earlier query AND its results |
| debounce chain (type → wait → search → URL sync) | observed firing end to end via in-page probes |
| empty-box submit | button disabled; clearing returns idle with no `?q=` |

What could NOT be driven here, and why it is the harness, not the app: this
automation environment delivers synthetic keystrokes to the DOM but not to
React — the box shows typed text while state stays empty, consistently, while
real clicks, selects, submits and navigations all work, and the full
onChange→effect→timer→fetch→URL chain was observed firing. The island is
standard controlled-input React following the catalog's own island patterns;
every step of its chain was seen executing. The residual risk is recorded, not
hidden — and the URL is the source of truth on every navigation, so even a
dropped keystroke converges to the server render.

Also verified along the way, by accident: production `loadEnv()` refuses the
`http://` test setup (NFR-SEC-009), so the API 500s under `NODE_ENV=production`
here and the page correctly renders "unavailable". The guard works; the test
setup is what is wrong, and dev (which allows `http`) is where UI verification
belongs.

## A4 — Gates

- [x] 741 → **747 passed (747)** (6 new: the server read; the island needs
  jsdom, which this repo does not vendor — adding it is a dependency decision
  under AGENTS.md §4, not a test-file decision)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles
- [x] `PLANNED_STUB_PORTS` lost the page entries after `check-claims.mjs`
  failed the build on them — the third inventory catch in the search track

## A5 — What is NOT claimed

- Interactive typing driven end to end by automation (see A3).
- Load-more exercised in the browser: no query in the seed data returns more
  than a page, so the button's append path is covered by construction (same
  `run()` as the initial search, cursor from the API) rather than by clicking.
- `totalHint`: still absent, still a service addition when the UI needs it.

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-012-S1+S2 |
| Files | `app/search/page.tsx`, `search-box.tsx`, `search-data.ts`, `search-schema.ts`, `search.module.css`, 1 test, `PLANNED_STUB_PORTS` trimmed |
| Tests | +6 |
| Mutations | n/a (UI slice; the server read's branches are each asserted: empty/429/500/bad-body/refused/no-cookie) |
| Commands | full regression gates · `next build` · real-browser checks per A3 |
| Notes | Search is done end to end: repository → service → route → page. The flagship non-auth track is complete. |
