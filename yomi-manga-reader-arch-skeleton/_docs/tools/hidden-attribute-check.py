#!/usr/bin/env python3
"""Assert the `hidden` attribute actually hides, in a real browser.

The defect this exists for
---------------------------
The UA stylesheet's `[hidden] { display: none }` loses to ANY author rule that
sets `display` on the same element, because author declarations beat UA ones
regardless of specificity. A component written as `.rcomplete { display: grid }`
and then hidden with `element.hidden = true` therefore stays laid out and
painted. That shipped: the prototype's completion card measured 416x243 with
`display: grid` while carrying `hidden`.

Why a static grep is not enough
-------------------------------
Grepping for `[hidden]` in the CSS only proves a guard is *declared*. It says
nothing about whether the guard wins the cascade, which is the entire failure
mode. It also cannot see a rule that only exists inside a media query, or a
`display` declared on a selector several steps removed from the element. The
invariant is about computed style, so this check measures computed style.

What it does
------------
For every page in every tier, in three viewport widths:

  1. Every element carrying `hidden` must compute to `display: none`.
  2. No such element may have a non-zero border box.  A `display: none`
     element has no box, so this catches anything that is hidden from the
     accessibility tree but still rendered (a stray `visibility`, an
     absolutely positioned remnant, a bad `content-visibility`).
  3. The guard must actually WIN, for every component class in the set that
     sets a `display`. This is checked behaviourally: a probe element is
     inserted with that class and `hidden` set, and its computed display is
     read back. Reading `document.styleSheets[].cssRules` is not an option
     here — Chromium throws SecurityError for file:// stylesheets — and it
     would be weaker anyway, because it asserts the declaration rather than
     the cascade result.
  4. Every `hidden` attribute on the page must be accounted for by a known
     script, so a newly introduced `hidden` cannot slip through unaudited.
  5. No uncaught page error on load, and every `getElementById` in the
     scripts the page loads must resolve. An unresolved id makes a script
     throw mid-render, which silently stops every statement after it — that
     is how the position indicator froze while the page artwork kept
     updating, and it is invisible to any check that only reads markup.

Then it exercises the states that matter, because a guard that suppresses
everything would pass step 1 forever:

  5. The reader's completion card must be `display: none` before the reading
     end and NOT `none` at it.
  6. The reader's countdown must be `display: none` when auto-advance is off
     and not `none` when it is on and the card is up.
  7. The reader's chrome bars must be `display: none` after the B key and
     not `none` before it.
  8. The catalog's list view must be `display: none` in grid mode and not
     `none` in list mode, and filtering must actually remove rows from layout.

Usage:
    python3 tools/hidden-attribute-check.py            # all tiers
    python3 tools/hidden-attribute-check.py prototype  # one tier
Exit: 0 if every assertion holds, 1 otherwise.
"""
import pathlib
import re
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sys.stderr.write(
        "playwright is required: pip install playwright && playwright install chromium\n")
    sys.exit(2)

ROOT = pathlib.Path(__file__).resolve().parent.parent
TIERS = ["wireframes", "lofi", "hifi", "prototype"]
VIEWPORTS = [("320x900", 320, 900), ("768x1024", 768, 1024), ("1440x900", 1440, 900)]

# Every id the prototype scripts toggle `hidden` on, and the script that owns
# it. Step 4 fails on an unlisted id, so a new toggle has to be audited.
KNOWN_TOGGLES = {
    "complete": "reader.js", "countdown": "reader.js", "banner": "reader.js",
    "top-bar": "reader.js", "bottom-bar": "reader.js", "position": "reader.js",
    "rail": "reader.js",
    "grid-empty": "catalog.js", "list-empty": "catalog.js",
    "grid-view": "catalog.js", "list-view": "catalog.js",
}

AUDIT_HIDDEN = """
() => {
  const rows = [];
  document.querySelectorAll('[hidden]').forEach((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    rows.push({
      id: el.id || null,
      tag: el.tagName,
      display: cs.display,
      visibility: cs.visibility,
      w: Math.round(r.width),
      h: Math.round(r.height)
    });
  });
  return rows;
}
"""

# Component classes across the set that set a `display`. These are the exact
# selectors that used to beat the UA `[hidden]` rule, so the guard has to win
# for every one of them, not merely be declared somewhere.
DISPLAY_CLASSES = [
    "rcomplete", "rcomplete__countdown", "rbar", "rbar__nav", "rposition",
    "rrail", "rrail__group", "rbanner", "empty", "stack", "ruled",
    "ruled-row", "grid-covers", "card__head", "cover", "table", "rzones",
]

GUARD_PROBE = """
(classes) => {
  const bad = [];
  for (const cls of classes) {
    const el = document.createElement('div');
    el.className = cls;
    el.hidden = true;
    document.body.appendChild(el);
    const d = getComputedStyle(el).display;
    const r = el.getBoundingClientRect();
    if (d !== 'none' || r.width !== 0 || r.height !== 0) {
      bad.push({ cls: cls, display: d, w: Math.round(r.width), h: Math.round(r.height) });
    }
    el.remove();
  }
  return bad;
}
"""

# Every getElementById the page's own scripts reference must resolve against
# the ids the page declares. An unresolved id makes the script throw
# mid-render, which silently stops every statement after the throw -- the
# failure is invisible to any check that only reads markup, because the page
# still looks alive. It is also invisible to a reader: the page artwork keeps
# updating while the position indicator stays frozen at its initial value.
#
# The scripts are read from disk rather than fetched, because fetch() is
# blocked on file:// and the point is to check the files that ship.
DECLARED_IDS = """
() => Array.from(document.querySelectorAll('[id]')).map((el) => el.id)
"""

PAGE_SCRIPTS = """
() => Array.from(document.querySelectorAll('script[src]'))
         .map((el) => el.getAttribute('src').split('/').pop())
"""

ID_CALL = re.compile(r"getElementById\(['\"]([^'\"]+)['\"]\)")


def script_id_refs(tier, script_name):
    """getElementById targets in a script shipped with this tier."""
    p = ROOT / tier / script_name
    if not p.is_file():
        return set()
    return set(ID_CALL.findall(p.read_text(encoding="utf-8")))

# The reader's own state, read from the DOM rather than from a module scope,
# so this measures what is rendered.
READER_STATE = """
() => {
  const idx = document.getElementById('display-index');
  const tot = document.getElementById('display-total');
  const pos = document.getElementById('position');
  const mode = document.getElementById('canvas').getAttribute('data-mode');
  const label = document.querySelector('#stage .rpage__label, #column .pslot[data-current] .rpage__label');
  const cur = document.querySelector('#column .pslot[data-current="true"] .rpage__label');
  const disp = (el) => (el ? getComputedStyle(el).display : '(absent)');
  return {
    displayIndex: idx ? idx.textContent.trim() : null,
    total: tot ? tot.textContent.trim() : null,
    mode: mode,
    currentSlotLabel: cur ? cur.textContent.trim() : null,
    complete: disp(document.getElementById('complete')),
    countdown: disp(document.getElementById('countdown')),
    banner: disp(document.getElementById('banner')),
    topBar: disp(document.getElementById('top-bar')),
    bottomBar: disp(document.getElementById('bottom-bar')),
    position: disp(document.getElementById('position')),
    rail: disp(document.getElementById('rail'))
  };
}
"""


class Report:
    def __init__(self):
        self.failures = []
        self.checks = 0

    def ok(self, label):
        self.checks += 1
        print("  ok    " + label)

    def fail(self, label, detail=""):
        self.checks += 1
        self.failures.append(label)
        print("  FAIL  " + label)
        if detail:
            for line in detail.splitlines():
                print("        " + line)

    def expect(self, cond, label, detail=""):
        self.ok(label) if cond else self.fail(label, detail)


def audit_page(r, page, path, vp_name, tier, page_errors):
    rows = page.evaluate(AUDIT_HIDDEN)

    for row in rows:
        tag = ("#" + row["id"]) if row["id"] else ("<" + row["tag"] + ">")
        detail = (f"computed display: {row['display']}\n"
                  f"computed visibility: {row['visibility']}\n"
                  f"border box: {row['w']}x{row['h']}")
        r.expect(row["display"] == "none",
                 f"{tier}/{path.name} @{vp_name}: {tag} [hidden] computes display:none",
                 detail)
        r.expect(row["w"] == 0 and row["h"] == 0,
                 f"{tier}/{path.name} @{vp_name}: {tag} [hidden] has no box",
                 detail)

    # Step 4: every hidden id must be owned by a known script.
    for row in rows:
        if row["id"] and row["id"] not in KNOWN_TOGGLES:
            r.fail(f"{tier}/{path.name}: [hidden] id '{row['id']}' is not in the audited "
                   f"toggle list (tools/hidden-attribute-check.py KNOWN_TOGGLES)")

    # Step 3: the guard must win for every class that sets a display.
    bad = page.evaluate(GUARD_PROBE, DISPLAY_CLASSES)
    if bad:
        detail = "\n".join(f".{b['cls']} + hidden -> display:{b['display']} "
                           f"box {b['w']}x{b['h']}" for b in bad)
        r.fail(f"{tier}/{path.name} @{vp_name}: [hidden] does not win the cascade for "
               f"{len(bad)} component class(es)", detail)
    else:
        r.ok(f"{tier}/{path.name} @{vp_name}: [hidden] wins the cascade for all "
             f"{len(DISPLAY_CLASSES)} display-setting classes")

    # Step 5: no uncaught error, and every referenced id resolves.
    if page_errors:
        r.fail(f"{tier}/{path.name} @{vp_name}: uncaught page error on load: {page_errors[0]}")
    else:
        r.ok(f"{tier}/{path.name} @{vp_name}: no uncaught page error on load")

    declared = set(page.evaluate(DECLARED_IDS))
    unresolved = []
    for script_name in page.evaluate(PAGE_SCRIPTS):
        for ref in script_id_refs(tier, script_name):
            if ref not in declared:
                unresolved.append(f"{script_name} -> #{ref}")
    if unresolved:
        r.fail(f"{tier}/{path.name}: script references ids the page does not declare: "
               + ", ".join(unresolved))
    else:
        r.ok(f"{tier}/{path.name}: every getElementById in its scripts resolves")

    if not rows:
        r.ok(f"{tier}/{path.name} @{vp_name}: no [hidden] elements on this page")
    else:
        r.ok(f"{tier}/{path.name} @{vp_name}: {len(rows)} [hidden] element(s) all resolve "
             f"to display:none")


CONTAINERS = """
() => {
  const col = document.getElementById('column');
  const stg = document.getElementById('stage');
  const box = (el) => { const b = el.getBoundingClientRect();
    return { h: Math.round(b.height), top: Math.round(b.top) }; };
  return {
    mode: document.getElementById('canvas').getAttribute('data-mode'),
    columnSlots: col ? col.children.length : -1,
    columnBox: col ? box(col) : null,
    stagePages: stg ? stg.querySelectorAll('.rpage').length : -1,
    stageBox: stg ? box(stg) : null,
    totalPageEls: document.querySelectorAll('.rpage').length
  };
}
"""


def container_checks(r, page):
    """The inactive container must be empty.

    Both containers are children of one grid, so a stale vertical column left
    behind by a switch into a paged mode does not sit harmlessly beside the
    page: it stacks above it. Measured at the chapter start, the stage landed
    290,880px below the fold while the reader looked completely inert, which
    reads as "clicking Next does nothing" rather than as a layout fault.
    """
    page.goto((ROOT / "prototype" / "reader.html").as_uri())
    page.wait_for_timeout(500)
    # clear any direction override a previous run persisted
    page.evaluate("() => { try { localStorage.removeItem('yomi-prefs'); } catch (e) {} }")
    page.reload()
    page.wait_for_timeout(500)

    v = page.evaluate(CONTAINERS)
    r.expect(v["mode"] == "vertical", "container check: starts in vertical mode",
             f"got {v['mode']}")
    r.expect(v["columnSlots"] == 240,
             "container check: vertical mode fills the column with one slot per page",
             f"got {v['columnSlots']}")
    r.expect(v["stagePages"] == 0,
             "container check: vertical mode leaves the paged stage EMPTY",
             f"got {v['stagePages']}")

    page.keyboard.press("m")
    page.wait_for_timeout(400)
    p1 = page.evaluate(CONTAINERS)
    r.expect(p1["mode"] == "paged", "container check: M moves to a paged mode",
             f"got {p1['mode']}")
    r.expect(p1["columnSlots"] == 0,
             "container check: a paged mode leaves the vertical column EMPTY "
             "(not 240 stale slots stacked above the page)",
             f"got {p1['columnSlots']} slots, column still {p1['columnBox']['h']}px tall")
    r.expect(p1["stagePages"] == 1, "container check: single mode puts exactly one page "
             "in the stage", f"got {p1['stagePages']}")
    r.expect(p1["stageBox"]["top"] < 400,
             "container check: the paged page is inside the viewport, not below the fold",
             f"stage top = {p1['stageBox']['top']}px")

    page.keyboard.press("m")
    page.wait_for_timeout(400)
    p2 = page.evaluate(CONTAINERS)
    r.expect(p2["stagePages"] == 2, "container check: double mode puts two pages in "
             "the stage", f"got {p2['stagePages']}")
    r.expect(p2["columnSlots"] == 0,
             "container check: double mode still leaves the column empty",
             f"got {p2['columnSlots']}")
    r.expect(p2["totalPageEls"] == 2,
             "container check: exactly 2 page elements exist in the document "
             "(no accumulation across mode switches)",
             f"got {p2['totalPageEls']}")

    page.keyboard.press("m")
    page.wait_for_timeout(400)
    back = page.evaluate(CONTAINERS)
    r.expect(back["mode"] == "vertical" and back["stagePages"] == 0,
             "container check: returning to vertical empties the stage again",
             f"mode={back['mode']} stage={back['stagePages']}")
    r.expect(back["columnSlots"] == 240,
             "container check: returning to vertical refills the column",
             f"got {back['columnSlots']}")


NEXT_STATE = """
() => {
  const t = (id) => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
  return { idx: t('display-index'), total: t('display-total'),
           stage: document.getElementById('stage').textContent.replace(/\\s+/g, ' ').trim() };
}
"""


def navigation_checks(r, page):
    """Next and Previous must actually move the page, in both directions."""
    def load(mode_keypresses=1):
        page.goto((ROOT / "prototype" / "reader.html").as_uri())
        page.wait_for_timeout(500)
        page.evaluate("() => { try { localStorage.removeItem('yomi-prefs'); } catch (e) {} }")
        page.reload()
        page.wait_for_timeout(500)
        for _ in range(mode_keypresses):
            page.keyboard.press("m")
            page.wait_for_timeout(220)

    def idx():
        return int(page.evaluate(NEXT_STATE)["idx"])

    total_pages = 240
    for direction in ("rtl", "ltr"):
        load()
        # Park mid-chapter FIRST, then flip if needed. The order matters: the
        # reading-start page is the highest page number in right to left and
        # the lowest in left to right, so flipping before parking can leave the
        # reader sitting on the reading end, where Next is correctly a no-op.
        for _ in range(5):                     # RTL: ArrowLeft is next
            page.keyboard.press("ArrowLeft")
            page.wait_for_timeout(150)
        if direction == "ltr":
            page.keyboard.press("d")
            page.wait_for_timeout(350)

        before = idx()
        r.expect(1 < before < total_pages,
                 f"{direction}: the test parks mid-chapter before asserting "
                 f"(displayIndex strictly inside 1..{total_pages})",
                 f"got displayIndex {before}")
        page.click("#rail [data-act=\"next\"]")
        page.wait_for_timeout(320)
        after_next = idx()
        page.click("#rail [data-act=\"prev\"]")
        page.wait_for_timeout(320)
        after_prev = idx()

        r.expect(after_next == before + 1,
                 f"{direction}: the Next button advances displayIndex by one",
                 f"{before} -> {after_next}")
        r.expect(after_prev == before,
                 f"{direction}: the Previous button returns to the same displayIndex",
                 f"{after_next} -> {after_prev}")
        print(f"        ({direction}: displayIndex {before} -> {after_next} "
              f"-> {after_prev} of {total_pages})")

    # the reading end must be a no-op, with no wrap-around (§13, T-READER-033)
    load()
    page.evaluate("() => { const c = document.getElementById('auto-toggle');"
                  " c.checked = false; c.dispatchEvent(new Event('change')); }")
    page.keyboard.press("End")
    page.wait_for_timeout(1700)
    at_end = idx()
    total = int(page.evaluate(NEXT_STATE)["total"])
    r.expect(at_end == total,
             f"End reaches displayIndex {total} of {total}, the reading end",
             f"got {at_end} of {total}")
    page.click("#rail [data-act=\"next\"]")
    page.wait_for_timeout(400)
    after_end_next = idx()
    r.expect(after_end_next == at_end,
             "Next at the reading end is a no-op, with no wrap-around "
             "(reader-behavior.md §13, T-READER-033)",
             f"{at_end} -> {after_end_next}")
    print(f"        (at the reading end {at_end} of {total}: Next -> {after_end_next}, no wrap)")


def reader_state_checks(r, page):
    """The guard must fix the hidden case without suppressing the visible one."""
    # --- boot: nothing up yet, and auto-advance is on
    page.goto((ROOT / "prototype" / "reader.html").as_uri())
    page.wait_for_timeout(500)
    s = page.evaluate(READER_STATE)
    r.expect(s["complete"] == "none",
             "reader at chapter start: completion card is display:none",
             f"got {s['complete']}")
    r.expect(s["countdown"] == "none",
             "reader at chapter start: countdown is display:none",
             f"got {s['countdown']}")
    r.expect(s["banner"] == "none",
             "reader at chapter start: banner is display:none",
             f"got {s['banner']}")
    r.expect(s["topBar"] != "none", "reader at chapter start: top bar is visible",
             f"got {s['topBar']}")

    # --- chrome toggle: B must hide the chrome, and B again must bring it back
    page.keyboard.press("b")
    page.wait_for_timeout(250)
    s = page.evaluate(READER_STATE)
    for name in ("topBar", "bottomBar", "position"):
        r.expect(s[name] == "none",
                 f"after the B key: {name} is display:none",
                 f"got {s[name]}")
    r.expect(s["rail"] == "none",
             "after the B key: the rail is display:none",
             f"got {s['rail']}")

    page.keyboard.press("b")
    page.wait_for_timeout(250)
    s = page.evaluate(READER_STATE)
    r.expect(s["topBar"] != "none",
             "after a second B: the top bar is visible again",
             f"got {s['topBar']}")
    r.expect(s["position"] != "none",
             "after a second B: the position indicator is visible again",
             f"got {s['position']}")

    # --- the visible case: reach the reading end and the card must APPEAR
    page.goto((ROOT / "prototype" / "reader.html").as_uri())
    page.wait_for_timeout(500)
    page.keyboard.press("End")
    page.wait_for_timeout(1600)          # completion needs the last page up 1s
    s = page.evaluate(READER_STATE)
    r.expect(s["complete"] != "none",
             "at the reading end: the completion card IS displayed (the guard does "
             "not suppress the visible case)",
             f"got {s['complete']}")
    r.expect(s["displayIndex"] == s["total"],
             "at the reading end: the indicator shows the last page",
             f"got Page {s['displayIndex']} of {s['total']}")
    card_visible = page.evaluate(
        "() => { const r = document.getElementById('complete').getBoundingClientRect();"
        " return r.width > 0 && r.height > 0; }")
    r.expect(card_visible, "at the reading end: the completion card has a real box")

    # --- countdown on when auto-advance is on
    cd = page.evaluate("() => getComputedStyle(document.getElementById('countdown')).display")
    r.expect(cd != "none",
             "at the reading end with auto-advance on: the countdown IS displayed",
             f"got {cd}")

    # --- countdown off: the control must still be hideable
    page.keyboard.press("Escape")
    page.goto((ROOT / "prototype" / "reader.html").as_uri())
    page.wait_for_timeout(400)
    page.evaluate("() => { const c = document.getElementById('auto-toggle');"
                  " c.checked = false; c.dispatchEvent(new Event('change')); }")
    page.keyboard.press("End")
    page.wait_for_timeout(1600)
    s = page.evaluate(READER_STATE)
    r.expect(s["complete"] != "none",
             "with auto-advance off: the card still appears at the reading end",
             f"got {s['complete']}")

    # --- the banner: shown by a real event, then hidden again
    page.goto((ROOT / "prototype" / "reader.html").as_uri())
    page.wait_for_timeout(400)
    page.evaluate("() => { document.getElementById('fail-toggle').click(); }")
    page.keyboard.press("m")   # cycle to single so the failed page is reachable
    page.wait_for_timeout(200)
    page.keyboard.press("m")
    page.wait_for_timeout(200)
    page.keyboard.press("m")
    page.wait_for_timeout(300)
    bd = page.evaluate("() => getComputedStyle(document.getElementById('banner')).display")
    r.expect(bd == "none", "no banner event: the banner stays display:none", f"got {bd}")


def catalog_state_checks(r, page):
    """The same guard, on the other page whose JS drives `hidden`."""
    page.goto((ROOT / "prototype" / "discover.html").as_uri())
    page.wait_for_timeout(500)

    s = page.evaluate("""() => ({
      list: getComputedStyle(document.getElementById('list-view')).display,
      grid: getComputedStyle(document.getElementById('grid-view')).display,
      gridEmpty: getComputedStyle(document.getElementById('grid-empty')).display,
      listEmpty: getComputedStyle(document.getElementById('list-empty')).display,
      rows: document.querySelectorAll('#cover-grid > li').length,
      visibleRows: Array.from(document.querySelectorAll('#cover-grid > li'))
        .filter((el) => getComputedStyle(el).display !== 'none').length,
      line: document.getElementById('result-line').textContent.trim()
    })""")
    r.expect(s["list"] == "none", "catalog in grid mode: the list view is display:none",
             f"got {s['list']}")
    r.expect(s["grid"] != "none", "catalog in grid mode: the grid view is visible",
             f"got {s['grid']}")
    r.expect(s["gridEmpty"] == "none", "catalog with results: the empty state is display:none",
             f"got {s['gridEmpty']}")
    r.expect(s["rows"] == s["visibleRows"] == 12,
             "catalog with no filter: all 12 rows are laid out",
             f"{s['visibleRows']} of {s['rows']}")

    # switch to list
    page.click("#view-list")
    page.wait_for_timeout(250)
    s2 = page.evaluate("""() => ({
      list: getComputedStyle(document.getElementById('list-view')).display,
      grid: getComputedStyle(document.getElementById('grid-view')).display
    })""")
    r.expect(s2["list"] != "none", "catalog in list mode: the list view is visible",
             f"got {s2['list']}")
    r.expect(s2["grid"] == "none", "catalog in list mode: the grid view is display:none",
             f"got {s2['grid']}")
    page.click("#view-grid")
    page.wait_for_timeout(200)

    # filter, and check rows actually leave the layout
    page.fill("#q", "lantern")
    page.wait_for_timeout(400)
    s3 = page.evaluate("""() => ({
      visibleRows: Array.from(document.querySelectorAll('#cover-grid > li'))
        .filter((el) => getComputedStyle(el).display !== 'none').length,
      line: document.getElementById('result-line').textContent.trim()
    })""")
    r.expect(s3["visibleRows"] == 1,
             "catalog filtered to one title: exactly 1 row is laid out",
             f"{s3['visibleRows']} rows, result line says {s3['line']!r}")

    # no matches: the empty state must appear
    page.fill("#q", "zzzznomatch")
    page.wait_for_timeout(400)
    s4 = page.evaluate("""() => ({
      gridEmpty: getComputedStyle(document.getElementById('grid-empty')).display,
      visibleRows: Array.from(document.querySelectorAll('#cover-grid > li'))
        .filter((el) => getComputedStyle(el).display !== 'none').length
    })""")
    r.expect(s4["gridEmpty"] != "none",
             "catalog with no matches: the empty state IS displayed",
             f"got {s4['gridEmpty']}")
    r.expect(s4["visibleRows"] == 0,
             "catalog with no matches: 0 rows laid out",
             f"{s4['visibleRows']} rows")


def main():
    tier_filter = sys.argv[1] if len(sys.argv) > 1 else None
    tiers = [tier_filter] if tier_filter else TIERS
    r = Report()

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for tier in tiers:
            tier_dir = ROOT / tier
            if not tier_dir.is_dir():
                r.fail(f"tier directory {tier} does not exist")
                continue
            pages = sorted(tier_dir.glob("*.html"))
            print(f"\n=== {tier}: {len(pages)} pages x {len(VIEWPORTS)} viewports ===")
            for vp_name, w, h in VIEWPORTS:
                ctx = browser.new_context(viewport={"width": w, "height": h})
                page = ctx.new_page()
                for p in pages:
                    errors = []
                    handler = lambda e: errors.append(str(e))
                    page.on("pageerror", handler)
                    page.goto(p.as_uri())
                    page.wait_for_timeout(320)
                    try:
                        audit_page(r, page, p, vp_name, tier, errors)
                    finally:
                        page.remove_listener("pageerror", handler)
                ctx.close()

        print("\n=== behavioural states: the guard must not suppress the visible case ===")
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("pageerror", lambda e: r.fail(f"reader page error: {e}"))
        reader_state_checks(r, page)
        catalog_state_checks(r, page)
        container_checks(r, page)
        navigation_checks(r, page)
        ctx.close()
        browser.close()

    print(f"\n{r.checks - len(r.failures)}/{r.checks} checks pass")
    if r.failures:
        print(f"\n{len(r.failures)} FAILURES:")
        for f in r.failures:
            print("  " + f)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
