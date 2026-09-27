# Yomi — design artifacts

Static design work for the Yomi manga/comic reader, in four fidelity tiers.
Everything here opens directly from `file://`: no build step, no server, no
network, no external fonts.

```
_docs/
  README.md            this file
  wireframes/          tier 1 — structure and information hierarchy only
  lofi/                tier 2 — real layout, real type scale, real spacing
  hifi/                tier 3 — production-intent visual design, light and dark
  prototype/           tier 4 — a working reader, in vanilla JavaScript
  tools/               the two checks that back the claims below
```

Start at `prototype/reader.html`. It is the screen this product is about, and
it is the only tier where the reader actually behaves.

---

## 1. What each tier is for

The four tiers are not four prettiness levels of the same drawing. Each one
answers a question the previous one cannot, and each deliberately throws away
what the previous tier was for.

| Tier | Question it answers | What it fixes | What it refuses to decide |
|---|---|---|---|
| **1 · Wireframe** | Is the structure right? | Landmarks, reading order, region labels, the direction matrix, the breakpoint matrix | Colour, typeface, scale, density |
| **2 · Lo-fi** | Are the proportions and density believable? | A real type scale, a 4px spacing rhythm, real lists, real tables, real forms | Colour, depth, illustration, any visual idea |
| **3 · Hi-fi** | Does it look designed, in both themes, at the contrast floor? | The token set, the visual direction, light and dark, motion, forced-colours | Behaviour |
| **4 · Prototype** | Does it work? | The reader's state, direction rules, input, completion, failure | Anything that needs a server |

The tiers disagree in useful ways. The wireframe shows the reader's chrome in
three separate frames because the *structural* difference matters; the hi-fi
shows one reader that responds to the viewport because the *visual* result is
the same three placements. The wireframe draws the tap zones as three
labelled boxes; the prototype draws them as an overlay that can be switched
off, because in the product they are an enhancement and the chrome is the
interface.

### Tier 1 — wireframes

`wireframes/*.html` plus `wireframes/wireframes.css`.

Grayscale boxes with visible region labels. Every block says what it is
(`<header>`, `chapter list`, `reader canvas`, "right rail, 640–1023px"). No
colour, no typeface, no scale decision. The stylesheet exists only so the
boxes are legible; the font is monospace so that region labels read as
annotation rather than as design.

Annotations on each page cite the section of the specification that produced
the structure, so a disagreement can be settled by reading the source rather
than by arguing about the drawing.

### Tier 2 — lo-fi

`lofi/*.html` plus `lofi/lofi.css`.

Real layout with a real type scale (12 / 13 / 15 / 16 for body and labels,
24 and 32 for headings, 40 for a manga title) and a real 4px spacing grid.
The palette is deliberately grayscale and depth comes from one hairline
border token, so proportion and density can be judged on their own. Real
`<button>`, `<a>`, `<table>`, `<ol>` and labelled form controls throughout,
because at this tier the question is density and a div soup cannot answer it.

The reader is drawn four times: the three chrome placements from
`reader-behavior.md` §2, and double-page mode in both directions.

### Tier 3 — hi-fi

`hifi/*.html` plus `hifi/tokens.css` and `hifi/hifi.css`.

**The visual direction: "ink on paper, read on an instrument."**

A warm-neutral paper ground. One vermilion accent — the colour of a seal, not
a gradient — with exactly two jobs: mark where you are, and fill the one
primary button on a view. An old-style serif for titles, because the product's
subject would be printed; the platform sans for chrome; tabular mono for any
figure a reader compares vertically. Hairline rules instead of boxes, so a
list of thirteen chapters reads as a ledger. Cards only where the card itself
is the interaction.

Three decisions worth naming, because they are the ones that make it a design
rather than a theme:

1. **The reader's chrome is dark in both themes.** It is the one place the
   system deliberately ignores the operating system. Page artwork is the only
   bright thing on screen while reading, and a chrome that flipped with the
   theme would compete with it. The page itself keeps its light paper for the
   same reason: a page of artwork does not invert.
2. **Figures are set in tabular mono**, and the chapter list has a fixed number
   column, so a 240-page omnibus and a 19-page chapter line up on one axis.
   That is a typographic choice doing layout work.
3. **One asymmetric move**: the catalog grid's first card spans two columns at
   72rem and up, because the first cover is the LCP element
   (NFR-PERF-001) and should have the largest box on the page. Below 72rem the
   override is dropped — an asymmetric grid at 320px is a broken grid.

`hifi/tokens.css` is the **only** file in the whole set where a colour value
is written. Every other stylesheet and every markup file references custom
properties. This is the T-FOUND-004 rule and it is what makes a token-level
contrast check meaningful: a colour cannot change without the check noticing.

**Light and dark.** Every colour in the token file is a `light-dark()` pair:

```css
--bg-canvas: light-dark(oklch(0.968 0.006 70), oklch(0.172 0.008 70));
```

`light-dark()` resolves against the computed `color-scheme`, so the manual
toggle needs no duplicated palette and no `prefers-color-scheme` media query
anywhere in the set. The toggle sets one attribute and nothing else, and it
offers three states rather than two: follow the system, pinned light, pinned
dark. "Follow the system" is a real preference, and silently overriding it is
the kind of thing a reader has to go and find in their operating system to
undo.

Dark mode is a re-authoring, not an inversion. The ground goes to ink, the
paper warmth stays in the highlights, the accent is lightened so it still
carries white-on-dark legibility as a fill, and the depth strategy drops the
lift and ambient layers and keeps only the ring, because both are invisible
against an ink ground.

**Focus.** A two-band indicator, which is the documented remedy for a problem
the product actually has: a single flat ring cannot clear 3:1 against both a
light surface and the vermilion fill. A ring dark enough for paper is too dark
for the fill; a ring light enough for the fill is invisible on paper. So both
bands are painted — the outer band on the surrounding surface, the inner band
against the control's own fill — and either is readable alone. On the reader
chrome, which is dark in both themes, one light band is used instead, because
there is no second surface to straddle.

**Motion.** One orchestrated page-load moment with a stagger, not scattered
micro-interactions. `transform` and `opacity` only. A 120ms page turn, which
is the only transition the product spends time on and the one that has to
stay cancellable by an opposite input. `prefers-reduced-motion: reduce`
collapses everything, and nothing is lost, because no information anywhere in
this set is carried by motion.

**Forced colours.** Windows High Contrast replaces the palette wholesale. The
work is to make sure nothing disappears: every surface that was distinguished
by a border gets it back, fills that carried meaning are replaced with system
colours, and progress bars and focus rings are re-expressed.

### Tier 4 — prototype

`prototype/*.html`, `prototype.css`, and four scripts.

A working reader. Mode cycling, a direction flip that actually mirrors the
column, the arrow keys, the swipe directions, the tap zones and the spread
pairing; five zoom steps; chrome show/hide; a page indicator showing
**displayIndex** rather than the physical page; the completion card in all
three of its variants; a failed page; and the full keyboard map from §9.

The catalog has a search field, genre chips, a status filter, a direction
filter, a sort, and a grid/list switch that all work, with a live result count
and a real empty state. The settings page writes the same preference record
the reader reads, so a default changed there applies the next time a chapter
opens.

`prototype/app.js` holds the theme toggle, the relative-time formatter, and
the preference store — one store with two callers, because
`reader-behavior.md` §16 has the reader and the settings page writing the same
record. `prototype/reader.js` is the reader. `catalog.js` and `settings.js`
are small and screen-specific.

---

## 2. Opening them

Open the file directly. Nothing needs to be served.

```
_docs/prototype/reader.html      the working reader — start here
_docs/prototype/discover.html    the catalog, with working filters
_docs/hifi/reader.html           the hi-fi reader: resize the window
_docs/hifi/index.html            the hi-fi overview, both themes
_docs/lofi/reader.html           the lo-fi reader, four frames
_docs/wireframes/index.html      the wireframe index
```

A few things to try:

- **Resize the window on either reader page.** Below 640px the controls are in
  a bottom bar; from 640px a right rail appears; from 1024px the top bar
  gains the control cluster. That is `reader-behavior.md` §2, and it is live
  CSS, not three drawings.
- **The theme button** in the header cycles system, light, dark.
- **In the prototype reader, press <kbd>M</kbd> then <kbd>D</kbd> and watch
  the indicator.** The page you are on does not move; the reading order around
  it does.
- **Press <kbd>End</kbd>, wait a second**, and the completion card appears with
  a 1.5 second countdown. Press <kbd>Space</kbd> to cancel it. Continue to
  Chapter 13, press <kbd>End</kbd> again, and you get the "not published yet"
  variant.
- **Turn on reduced motion** in your system settings, or **turn on Windows High
  Contrast**. Nothing disappears in either case.

---

## 3. Source specification, per screen

Every screen cites the section that produced it, in the page footer and in
the annotations on the wireframe and lo-fi pages.

| Screen | Route | Primary source |
|---|---|---|
| Reader | `/manga/[slug]/chapter/[chapter]` | `docs/product/reader-behavior.md` §2–§9, §11, §13, §15 |
| Reader states | reader states | `reader-behavior.md` §12–§15; EC-RDR-01, EC-RDR-03 |
| Catalog / discover | `/discover` | PRD FR-CATALOG-005; J-1 |
| Manga detail | `/manga/[slug]` | PRD FR-CATALOG-006; ACCESSIBILITY.md §2, §4 |
| Search | `/search` | PRD FR-SEARCH-*; EC-SE-01…04; ACCESSIBILITY.md §5 |
| Library | `/library` | PRD FR-LIBRARY-005; J-2 |
| History | `/history` | PRD FR-LIBRARY-*; EC-ADM-03 |
| Bookmarks | `/bookmarks` | PRD FR-LIBRARY-*; EC-RDR-06; T-LIB-008 |
| Sign in | `/auth/signin` | PRD FR-AUTH-003; ACCESSIBILITY.md §5, §6 |
| Settings | `/settings` | `reader-behavior.md` §16; ACCESSIBILITY.md §2, §5 |
| Admin: manga | `/admin/manga` | `docs/product/admin-workflow.md` §3, §4, §10 |
| Admin: upload | `/admin/uploads` | `admin-workflow.md` §5, §6; EC-UP-01…10 |
| Admin: audit | `/admin/audit` | `admin-workflow.md` §8; EC-ADM-06 |
| Error, not found, empty | `src/app/error.tsx`, `src/app/not-found.tsx` | ACCESSIBILITY.md §6; EC-RDR-02/08, EC-XX-04, EC-XX-06 |

The landmark and skip-link contract every page honours is the one
`src/shared/ui/AppShell.tsx` owes the product (T-FOUND-004): a skip link as
the first focusable element, a `<header>` with a labelled `<nav>`, exactly one
`<main id="main">`, a `<footer>`.

---

## 4. The two checks

Both are runnable and both read the artifacts rather than a summary of them.

### Contrast — WCAG 2.1 AA, measured

```
$ python3 tools/contrast-check.py hifi/tokens.css
...
120/120 pairs pass
```

It parses the `oklch()` and `light-dark()` values out of `hifi/tokens.css`,
converts OKLCH to linear sRGB, and computes the WCAG relative-luminance ratio
for all 60 pairings the product actually renders — 4.5:1 for text, 3:1 for
interface components and graphics, 3:1 for `ink-faint`, which is only ever
decorative or disabled text. Both themes are measured independently.

The numbers are measured, not estimated. Four values were wrong on the first
pass and were corrected because the checker said so: `ink-muted` on
`bg-inset` (4.17:1), `line-strong` on `bg-canvas` (2.82:1), `line-chrome` on
`bg-chrome` (2.03:1), and `--ink-on-reader-accent`, which had been given the
same name as two different roles and was silently resolving to the wrong one.

This is the offline stand-in for the CI token contrast check that
ACCESSIBILITY.md §3.3 and T-FOUND-004 require. It is not a substitute for
axe: it checks the token file, not the rendered page.

### Reader logic — the direction rules, against the shipped code

```
$ node tools/reader-logic-check.mjs
...
all 52 reader logic checks pass
```

This extracts `displayIndex`, `stepPage`, `spreadFor` and `clamp` out of
`prototype/reader.js` at run time and evaluates them, so it cannot pass
against a stale copy. It covers the cases TEST_STRATEGY.md names for
UNIT-READER-006 and UNIT-READER-007, plus the invariants from §4, §6, §8.1
and §13, at page counts 1, 19, 240, 241 and 500.

It found a real bug. The first version re-declared the spread functions by
hand, and immediately showed that an odd-length chapter produced a spread
partner outside `[1, M]` — which would have drawn a half-empty pair instead of
the single centred page that EC-RDR-03 requires. `spreadFor` now returns one
element in that case, and the extraction is kept so the two cannot drift.

### Structure and accessibility primitives

Every HTML file in all four tiers was checked for: `lang`, a non-empty
`<title>`, a viewport meta, a skip link as the first focusable element,
exactly one `<main>` with an id, `header` / `footer` / a *named* `nav`, exactly
one `<h1>`, no skipped heading levels, an `alt` on every image, no unlabelled
input (implicit or explicit), no `aria-label` on a role that does not support
naming, no external URL, no hardcoded colour in markup, and no `min-width`
above 320px. 51 of 51 files pass.

---

## 5. The constraints, and how they were met

**320px minimum, no horizontal overflow at any breakpoint.** Every grid track
is `minmax(0, 1fr)`, every table sits in an `overflow-x: auto` container so a
wide admin table scrolls inside its own box rather than widening the page, and
the cover grid drops its asymmetric first-card override below 72rem. The
reader's page box is computed from the canvas's measured inner width at run
time, so it cannot outgrow a narrow viewport.

**The skip link is the first focusable element; exactly one `<main>`;
landmarks present and named.** Checked mechanically on all 51 files, not by
eye. This is the `AppShell.tsx` contract.

**Tokens are the only place colours are defined.** `hifi/tokens.css` holds
every colour for tiers 3 and 4. The tier 1 and tier 2 stylesheets hold their
own, deliberately neutral, grayscale steps — each tier's stylesheet is that
tier's token sheet, and neither contains a colour that a component can
reference by anything other than a custom property. No markup file contains a
colour literal.

**The keyboard path never depends on a pointer affordance.** Tap zones and
swipes are enhancements with a visible, focusable button equivalent for every
action: previous, next, mode, direction, zoom, fullscreen, chrome, mark as
read. The reader takes initial focus on route entry. The prototype is fully
operable with zones off, swipes ignored, and no pointer at all.

**RTL is a real layout concern, not a mirror hack.** Direction decides the
reading order, the arrow keys, the swipe directions, the tap zones, the spread
pairing, and the indicator — six separate things, all driven from one value.
The vertical column is built in reading order, so the reading-start page is at
the top in both directions and scrolling down always advances. A
right-to-left spread carries `dir="rtl"`, and a grid whose inline axis is
reversed already places its first child on the right, so the page read first
sits on the right with no `order` override to fight it.

**No product content.** Every cover is a two-stop gradient built from two of
six tint tokens plus a label. Every chapter page is a labelled block. This is
TEST_STRATEGY.md §6's rule for generated test data applied to a design set,
and it is also the product's licensing condition: Yomi only ever holds content
the operator owns or is licensed for, so a prototype that showed real cover
art would be showing something the product would never have.

**`prefers-reduced-motion` and `forced-colors` degrade sanely.** Both are
handled in the shared stylesheets, so every tier gets them.

**No external fonts, no CDN, no network.** There is nothing to fetch. The
typeface personality therefore comes from the *pairing* and the scale rather
than from a downloaded face: an old-style serif against the platform sans,
with mono for figures. On a machine with no serif beyond the platform
default the hierarchy holds anyway, because it is carried by size and weight
as much as by family.

**Plain, grounded copy.** No marketing register, no exclamation marks, no
emoji, and no cheerleading. The product's own tone is precise and utilitarian
and the screens match it. Section headings say what the area is; the reader's
empty states say what happened and what to do about it.

---

## 6. Skills applied, and one deliberate departure

`SKILLS.md` §6 rules `ui-design` out of this repository, on the grounds that
"Reader UI here is constrained by `ACCESSIBILITY.md` + existing
`AppShell.tsx`". That ruling is about *implementing inside the product tree*.
These artifacts are net-new visual surfaces under `_docs/`, outside
`src/` and `tests/`, and they implement no product code — so `ui-design`
applies here, and the product tree is untouched. Both halves of that are
worth stating plainly, because the distinction is the whole reason the
`SKILLS.md` row does not apply.

| Skill | Loaded | How it was used |
|---|---|---|
| `ui-design` | yes | Direction + Build modes. Its Scaffold mode produced tier 1, which is why the wireframe stylesheet makes no colour or type decision. `direction/product-ui.md` set the density and restraint posture; `aesthetic-direction.md` removed the usual tells. |
| `accessibility` | yes | The contract every page is measured against, and the two-band focus indicator. |
| `frontend-ui-engineering` | yes | Component semantics: landmarks, real lists, labelled fields, the dialog, the empty and error states. |
| `userflow` | yes | Flow selection. Dispatched to `flow-forms`, `flow-search`, `flow-tables`, `flow-errors`, `flow-empty-states`, `flow-app-shell`, `flow-navigation`, `flow-settings`, `flow-auth`. |
| `high-end-visual-design` | yes, partially — see below | Two of its transferable rules were applied wholesale. |

**The departure, stated rather than hidden.** `high-end-visual-design` is an
agency-marketing skill. Its own §2 bans, and its §3 archetypes assume, a
surface that is trying to impress: nested double-bezel containers, pill CTAs
with button-in-button trailing icons, `py-24` section padding, radial mesh
gradients, scroll-triggered blur reveals, oversized display type.

Applied literally, those would have produced a manga reader that looks like a
landing page, and they conflict directly with the product's own
specification:

- `ui-design`'s `direction/product-ui.md` — which `ui-design` says wins on
  product surfaces — rules out "decorative gradients behind routine product
  UI" and "excessive spacing on data-dense surfaces: operators scroll instead
  of scan". A curator judging a 240-page upload job does not want `py-24`.
- ACCESSIBILITY.md §3.3 and the density in `admin-workflow.md` §10 ("dense but
  not dark-patterned") require the opposite of macro whitespace.
- `AGENTS.md` §8 is explicit: "Agent skills are advisory execution aids, never
  a source of requirements. The specification suite wins over any skill."

So the aesthetic rules were split rather than obeyed or discarded wholesale.
**Applied:** the banned-font and banned-icon lists (which is why the set has a
single hand-authored thin-stroke icon set and no decorative monospace), the
GPU-safe rule that only `transform` and `opacity` are animated, the z-index
discipline, the ban on default `shadow-md` in favour of a hand-authored depth
system, and real custom cubic-bezier easing rather than `linear` or
`ease-in-out` — `--ease-page: cubic-bezier(0.32, 0.72, 0, 1)` is that
skill's curve, applied to the one transition the product actually has.
**Not applied, and the product contract is the reason:** the double bezel,
the pill CTAs, the macro whitespace, the gradient orbs, and the scroll-reveal
choreography. A reader is an instrument, and the design goal was that the page
artwork is the only bright thing on screen.

---

## 7. Where the specification was ambiguous

Five places. Each one names the choice made and why. None of them is a
quietly invented requirement.

**1. The RTL double-page pairing contradicts the odd-page parenthetical.**
`reader-behavior.md` §6 defines the pairing normatively as
`(M, M−1), (M−2, M−3) …` — which is what T-READER-006 and UNIT-READER-006/007
test. The same sentence adds "(odd page = left page of LTR spread / right page
of RTL spread)". With an *even* M those two statements disagree: in
`(240,239), (238,237) …` the higher page is on the right, so the odd page is on
the **left**. The parenthetical only holds when M is odd, where the pairs are
`(241,240), (239,238) …`.

*Choice:* the pairing table is implemented exactly as written, and the first
page read is placed on the right. The parenthetical is treated as a loose
description that happens to be true for odd page counts. The pairing rule is
the one that is unit-tested and named in TEST_STRATEGY.md, so it is the one
that wins. **This is a `spec-question` for the repo, not something the design
set should have resolved on its own.**

**2. "Bottom-to-top column" in vertical RTL mode.** §3 says the vertical
column is "a continuous top-to-bottom column (LTR) — or bottom-to-top column,
i.e. the last page at the top, for RTL". "Bottom-to-top column" read strictly
would mean the scroll direction is reversed, which no scrolling container
does well and which would make `Home`, `End`, `PageDown` and the soft-snap
behaviour all direction-dependent in a way the rest of the spec does not
anticipate. The parenthetical resolves it: the last page is at the top.

*Choice:* the reading-start page is at the top of the column in both
directions, and scrolling down always advances the reading order. The column
is built in reading order, so the page order is `240, 239, … 1` in RTL and
`1, 2, … 240` in LTR. Three other statements confirm it: `displayIndex =
rtl ? M − pageNumber + 1 : pageNumber` makes the reading-start page index 1,
`Home` is specified as going to the first page in reading order, and the
vertical scroll input is specified as a plain column scroll.

**3. `←` / `→` in vertical mode.** §9's table gives the direction-aware
prev/next mapping for the Vertical column, but a continuous column has no
"previous page" to go to.

*Choice:* the keys move the scroll position by one viewport in the
direction-aware sense — forward scrolls down, previous scrolls up, with the
side swapped in RTL — and the page indicator follows the scroll. This is what
`↓`/`PageDown` already do, so the two agree, and the resulting page is the
page now at the top of the viewport, which is the same rule the reader uses
when the reader scrolls by hand.

**4. Whether the failed-image and completion overlays use the theme or the
reader chrome.** The spec places them in the reader and says the chrome is
always available, but does not say what surface they sit on.

*Choice:* the reader's overlays — completion card, offline banner, failed
page — sit on the reader chrome, not on the app surface, in both themes. The
reason follows from the design direction: the reader chrome is dark in both
themes precisely so that page artwork is the only bright thing on screen, and
an overlay that flipped with the operating system would break that in exactly
the moment the reader's attention is least elsewhere.

**5. The last-admin guard's UI wording.** EC-ADM-04 requires the control to
be disabled *and explained*.

*Choice:* disabled, with the reason in adjacent text rather than only in a
tooltip, on the grounds that a disabled control is not focusable and a
tooltip on a disabled control is unreachable by keyboard — which would fail
ACCESSIBILITY.md's keyboard requirement.

---

## 8. What is not here

No product code. `src/` and `tests/` are untouched, and nothing in this
directory is imported by the application. These are artifacts for review, and
the routes, components and tokens they describe have not been built.

The four admin routes that are a detail view of a screen already covered —
`/admin`, `/admin/manga/[id]`, `/admin/manga/[id]/chapters`, `/admin/users` —
are not given their own wireframe page, because they introduce no new
structure; they are composed from the admin list and audit screens. They are
the first thing to add if this set is extended.

The full route map in `src/app/` is 18 routes. The 14 screens here cover every
public route, both auth routes, the reader, and the three admin surfaces that
carry the most product-specific behaviour.
