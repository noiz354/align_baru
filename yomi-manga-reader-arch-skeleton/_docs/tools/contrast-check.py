#!/usr/bin/env python3
"""WCAG 2.1 contrast check for the Yomi design tokens.

This is the offline stand-in for the token contrast check that
ACCESSIBILITY.md §3.3 and T-FOUND-004 put in CI. It reads the oklch() and
light-dark() values straight out of hifi/tokens.css, converts
OKLCH -> linear sRGB, and computes the WCAG relative-luminance ratio for every
pair the product actually renders.

It reads the token file rather than a list of literals, so a colour cannot be
changed without the check noticing. Both themes are measured independently,
because light-dark() carries the pair in the value and the theme in the
resolved color-scheme.

Floors, from ACCESSIBILITY.md §3.3:
  - 4.5:1 for text
  - 3:1   for interface components and graphics (SC 1.4.11)
  - 3:1   for ink-faint, which is only ever decorative or disabled text

Usage:  python3 tools/contrast-check.py hifi/tokens.css
Exit:   0 if every pair passes, 1 otherwise.
"""
import re
import sys

# ---------------------------------------------------------------- colour math

def oklch_to_linear_srgb(L, C, H):
    h = H * 3.141592653589793 / 180.0
    a = C * __import__("math").cos(h)
    b = C * __import__("math").sin(h)

    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b

    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3

    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return (r, g, bb)


def relative_luminance(L, C, H):
    r, g, b = oklch_to_linear_srgb(L, C, H)
    # WCAG: channels are linear-light already after the oklab inverse,
    # but the spec's coefficients expect *linear* values -> use directly.
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def in_gamut(L, C, H):
    for c in oklch_to_linear_srgb(L, C, H):
        if c < -0.001 or c > 1.001:
            return False
    return True


def ratio(fg, bg):
    a = relative_luminance(*fg)
    b = relative_luminance(*bg)
    lo, hi = min(a, b), max(a, b)
    return (hi + 0.05) / (lo + 0.05)


# ---------------------------------------------------------------- css parsing

def parse_oklch(s):
    """oklch(L C H) -> (L, C, H), tolerating percentages and a / alpha."""
    m = re.match(r"oklch\(([^)]*)\)", s.strip())
    if not m:
        return None
    nums = []
    for part in m.group(1).split():
        part = part.strip()
        if part == "none":
            continue
        if part.startswith("/"):
            continue  # the alpha component of oklch(L C H / A)
        try:
            nums.append(float(part))
        except ValueError:
            return None
    if len(nums) < 3:
        return None
    L, C, H = nums[0], nums[1], nums[2]
    if L > 1.0001:
        L /= 100.0
    if C > 1.0001:
        C /= 100.0
    return (L, C, H)


def parse_tokens(path):
    css = open(path, encoding="utf-8").read()
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out = {}
    # section-scoped: remember the last :root / [data-theme] selector
    cur = None
    for line in css.splitlines():
        sel = re.match(r"\s*([.:\[][^{]*)\{", line)
        if sel and "oklch" not in line:
            cur = sel.group(1).strip()
            continue
        if line.strip() == "}":
            cur = None
            continue
        m = re.match(r"\s*(--[\w-]+)\s*:\s*light-dark\((.*)\)\s*;?", line)
        if m:
            # a light-dark() pair: the theme-scope is carried by the value, not
            # by the selector, so register it under both theme names
            name, body = m.group(1), m.group(2)
            inner = re.findall(r"oklch\([^()]*\)", body)
            if len(inner) >= 2:
                for scope_name, one in (("light", inner[0]), ("dark", inner[1])):
                    v = parse_oklch(one)
                    if v:
                        out[(scope_name, name)] = v
            continue
        m = re.match(r"\s*(--[\w-]+)\s*:\s*oklch\(([^)]+)\)", line)
        if m:
            name, body = m.group(1), m.group(2)
            v = parse_oklch("oklch(" + body + ")")
            if v:
                out[("both", name)] = v
            continue
    return out


THEME_SCOPE = {"light": "light", "dark": "dark"}


def resolve(tokens, theme, name):
    for scope in (THEME_SCOPE.get(theme, theme), "both", ":root"):
        if (scope, name) in tokens:
            return tokens[(scope, name)]
    return None


# ---------------------------------------------------------------- pair table

# (foreground token, background token, minimum ratio, what it is[, theme scope])
# theme scope: "both" | "light" | "dark".  Used where a pairing is only a
# real rendering in one theme (the reader surround is light in light theme and
# dark in dark theme, so a chrome-ink-on-surround pair is dark-theme only).
PAIRS = [
    # --- text
    ("--ink-primary",   "--bg-canvas", 4.5, "body text on page"),
    ("--ink-primary",   "--bg-surface", 4.5, "body text on card"),
    ("--ink-primary",   "--bg-sunken",  4.5, "body text on sunken"),
    ("--ink-primary",   "--bg-inset",   4.5, "body text on inset"),
    ("--ink-secondary", "--bg-canvas", 4.5, "secondary text on page"),
    ("--ink-secondary", "--bg-surface", 4.5, "secondary text on card"),
    ("--ink-secondary", "--bg-sunken",  4.5, "secondary text on sunken"),
    ("--ink-muted",     "--bg-canvas", 4.5, "meta/helper text on page"),
    ("--ink-muted",     "--bg-surface", 4.5, "meta/helper text on card"),
    ("--ink-muted",     "--bg-inset",   4.5, "meta text on inset"),
    ("--ink-faint",     "--bg-canvas", 3.0, "faint/disabled label (1.4.3 relaxed)"),
    ("--ink-faint",     "--bg-surface", 3.0, "faint on card"),
    ("--ink-on-accent", "--accent-base", 4.5, "label on filled accent button"),
    ("--ink-on-accent", "--accent-hover", 4.5, "label on accent hover"),
    ("--ink-on-accent", "--accent-press", 4.5, "label on accent press"),
    ("--accent-quiet-ink", "--accent-quiet-bg", 4.5, "accent badge text"),
    ("--accent-ink", "--bg-canvas", 4.5, "inline accent link on page"),
    ("--accent-ink", "--bg-surface", 4.5, "inline accent link on card"),
    ("--accent-ink", "--bg-inset", 4.5, "inline accent link on inset"),
    ("--status-ok-ink",     "--status-ok-bg",     4.5, "ok badge text"),
    ("--status-warn-ink",   "--status-warn-bg",   4.5, "warn badge text"),
    ("--status-danger-ink", "--status-danger-bg", 4.5, "danger badge text"),
    ("--status-info-ink",   "--status-info-bg",   4.5, "info badge text"),
    ("--status-draft-ink",  "--status-draft-bg",  4.5, "draft badge text"),
    # the failed-image label is printed on the page itself, which keeps its
    # light paper in both themes -> use the page-local danger ink
    ("--page-danger-ink", "--page-surface", 4.5, "failed-image label on paper"),
    ("--page-danger-ink", "--page-placeholder", 4.5, "failed-image label on art block"),

    # --- non-text UI (WCAG 1.4.11 -> 3:1)
    ("--line-strong",  "--bg-canvas", 3.0, "input border vs page"),
    ("--line-strong",  "--bg-surface", 3.0, "input border vs card"),
    ("--line-strong",  "--bg-inset",   3.0, "input border vs inset"),
    ("--line-default", "--bg-surface", 1.0, "divider (decorative)"),

    # --- focus, two-tone. Outer band clears 3:1 against the SURROUNDING
    #     surface; inner band clears 3:1 against the control's OWN fill.
    ("--focus-outer", "--bg-canvas", 3.0, "focus outer band vs page"),
    ("--focus-outer", "--bg-surface", 3.0, "focus outer band vs card"),
    ("--focus-outer", "--bg-sunken", 3.0, "focus outer band vs sunken"),
    ("--focus-outer", "--bg-inset",  3.0, "focus outer band vs inset"),
    ("--focus-outer", "--bg-reader-surround", 3.0, "focus outer band vs reader surround"),
    ("--focus-inner", "--accent-base", 3.0, "focus inner band vs accent fill"),
    # (the page area's ring is offset OUTSIDE the page, so it is asserted
    #  against the surround above, not against the paper)
    # reader chrome is dark in BOTH themes, so it uses the on-dark ring pair
    ("--focus-outer-on-dark", "--bg-chrome", 3.0, "chrome focus outer vs chrome"),
    ("--focus-outer-on-dark", "--bg-chrome-raised", 3.0, "chrome focus outer vs raised"),
    ("--focus-outer-on-dark", "--bg-reader-surround", 3.0, "chrome focus outer vs surround", "dark"),
    ("--focus-outer-on-dark", "--accent-reader-base", 3.0, "chrome focus ring vs reader accent fill"),
    ("--ink-on-reader-accent", "--accent-reader-base", 4.5, "label on reader accent button"),

    # --- reader instrument chrome
    ("--ink-chrome",        "--bg-chrome", 4.5, "reader chrome label"),
    ("--ink-chrome",        "--bg-chrome-raised", 4.5, "reader chrome label on raised"),
    ("--ink-chrome-muted",  "--bg-chrome", 4.5, "reader chrome meta"),
    ("--ink-chrome-muted",  "--bg-chrome-raised", 4.5, "reader chrome meta on raised"),
    ("--line-chrome",       "--bg-chrome", 3.0, "reader control border"),
    ("--line-chrome",       "--bg-chrome-raised", 3.0, "reader divider on raised"),
    ("--ink-reader-accent", "--bg-chrome", 3.0, "reader accent icon on chrome"),
    ("--ink-reader-accent", "--bg-reader-surround", 3.0, "reader accent icon on surround", "dark"),
    # surround is dark only in dark theme, so chrome ink on surround is too
    ("--ink-chrome",        "--bg-reader-surround", 4.5, "reader text on surround", "dark"),
    ("--ink-chrome-muted",  "--bg-reader-surround", 4.5, "reader meta on surround", "dark"),

    # --- the page: a physical object, theme-independent
    ("--page-ink",      "--page-surface", 4.5, "page label on paper"),
    ("--page-ink-soft", "--page-surface", 4.5, "page sub-label on paper"),
    ("--page-ink",      "--page-placeholder", 4.5, "page label on placeholder art"),
    ("--page-ink-soft", "--page-placeholder", 4.5, "page sub-label on placeholder art"),
    ("--page-outline",  "--page-surface", 1.0, "page 1px inset outline (decorative)"),
    ("--cover-ink",     "--cover-tint-a", 4.5, "cover label on art, tint A"),
    ("--cover-ink",     "--cover-tint-b", 4.5, "cover label on art, tint B"),
    ("--cover-ink",     "--cover-tint-c", 4.5, "cover label on art, tint C"),
    ("--cover-ink",     "--cover-tint-d", 4.5, "cover label on art, tint D"),
    ("--cover-ink",     "--cover-tint-e", 4.5, "cover label on art, tint E"),
    ("--cover-ink",     "--cover-tint-f", 4.5, "cover label on art, tint F"),
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "hifi/tokens.css"
    tokens = parse_tokens(path)
    themes = {
        "light": ":root",
        "dark": '[data-theme="dark"]',
    }
    fails = []
    total = 0
    for theme, sel in themes.items():
        print(f"\n=== {theme} ===")
        for pair in PAIRS:
            fg_name, bg_name, floor, label = pair[:4]
            scope_to = pair[4] if len(pair) > 4 else "both"
            if scope_to not in ("both", theme):
                continue
            fg = resolve(tokens, theme, fg_name)
            bg = resolve(tokens, theme, bg_name)
            if fg is None or bg is None:
                fails.append((theme, fg_name, bg_name, "MISSING TOKEN", floor, label))
                print(f"  MISSING  {fg_name} / {bg_name}  ({label})")
                continue
            total += 1
            r = ratio(fg, bg)
            ok = r >= floor
            if not ok:
                fails.append((theme, fg_name, bg_name, round(r, 2), floor, label))
            flag = "  ok " if ok else "FAIL "
            print(f"  {flag} {r:6.2f}:1  (need {floor})  {fg_name} on {bg_name}  -- {label}")

    print(f"\n{total - len(fails)}/{total} pairs pass")
    if fails:
        print("\nFAILURES:")
        for f in fails:
            print("  " + " | ".join(str(x) for x in f))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
