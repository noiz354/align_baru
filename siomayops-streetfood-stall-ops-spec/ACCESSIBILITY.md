# ACCESSIBILITY

**Document ID:** DOC-ACCESSIBILITY
**Status:** Phase 0 (specification)
**Related:** NFR-ACCESS-*, NFR-UX-*, `DESIGN.md`, `docs/design/DESIGN-SYSTEM.md`

---

## 1. The real accessibility context

The primary user is not a desktop keyboard user in an office. They are:

- standing on a street, in **direct sunlight**, wearing gloves, holding a ladle,
- on a **cheap Android phone** with a 5.5–6.5" screen, frequently with a cracked protector,
- with **wet or oily hands**, possibly with mild near-vision issues (and no reading glasses),
- and **in a hurry** because a customer is waiting.

"Accessibility" here means: legible, tappable, forgiving, and working under adverse conditions —
plus genuine support for users with disabilities.

---

## 2. Non-negotiable requirements

| # | Requirement | Why | Verification |
| --- | --- | --- | --- |
| A-1 | Tap targets ≥ 48×48 px; **money-critical actions ≥ 64 px tall** | Gloves, motion, sunlight | Browser test asserts computed sizes on key screens |
| A-2 | Body text ≥ 16 px; monetary totals ≥ 24 px bold | Legibility at arm's length | Visual regression + assertion |
| A-3 | WCAG 2.2 AA contrast (≥ 4.5:1 body, ≥ 3:1 large) | Sunlight legibility | Automated contrast checks in CI |
| A-4 | High-contrast "sunlight" mode | Outdoor readability | Manual QA checklist + screenshot |
| A-5 | Colour never the only signal | Colour-blind operators; glare | Review rule: every status has text/icon |
| A-6 | No horizontal scrolling at 360 px width | Cheapest common device | Playwright viewport tests |
| A-7 | Font scale honoured to 130% without layout breakage | OS settings reality | Playwright with device scale emulation |
| A-8 | All critical flows operable **without** map, camera, WebGL, or gestures | Device capability variance | Test: disable APIs, flows still complete |
| A-9 | Screen-reader labels on money fields, primary buttons, and status | Blind/low-vision operators and auditors | Semantic audit + axe-like checks in tests |
| A-10 | Plain Indonesian, short sentences, no jargon | Literacy and language variance | Content review checklist |
| A-11 | Numbers grouped as `Rp 12.500`, dates as `26 Sep 2026` | Familiar formats | Component tests |
| A-12 | Error messages state *what happened* and *what to do next* | Recoverability | Copy review |
| A-13 | Destructive actions require confirm/reason, never a swipe-only gesture | Accidental data loss | Flow tests |
| A-14 | Offline/pending state is perceivable without colour (text + icon + count) | Truthfulness + access | State tests |
| A-15 | HQ console keyboard navigable with visible focus; tables readable by screen readers | Auditor/office users | Manual + automated audit |

---

## 3. Two-surface contrast (why HQ can be denser)

| Aspect | Operator surface | HQ surface |
| --- | --- | --- |
| Density | Low (one decision per screen) | High (tables, filters) |
| Text size | Large (16–32 px) | Normal (14–16 px) |
| Target standard | Exceeds WCAG AA (practical sunlight use) | Meets WCAG AA |
| Navigation | Bottom-primary, thumb-reachable | Keyboard + mouse, breadcrumbs, shortcuts |
| Colour | Strong, high-contrast, few hues | Calmer, but same contrast floors |

Both surfaces must satisfy the same minimum bar; the operator surface exceeds it by design.

---

## 4. Inclusive design details

| User condition | Design response |
| --- | --- |
| Low literacy in accounting | No jargon, icon + word everywhere, numbers always paired with meaning |
| Colour vision deficiency | Status uses icon + text; charts use patterns/labels, not hue alone |
| Tremor / gloves | Large targets, generous spacing, no precision drags, no double-tap requirements |
| Sunlight glare | High-contrast mode, dark-on-light default, no low-opacity text |
| Hearing impairment | No audio-dependent steps; alerts are visual |
| Deaf/HoH + busy environment | No voice notes required; text-first communication |
| Vision impairment (HQ) | Scalable text, focus outlines, ARIA roles on tables/forms |
| Cognitive load / stress | One decision per screen in the field; no timers; nothing auto-submits |
| Language variance | Indonesian-first; avoid regional idiom in labels; synonyms supported in the menu catalog |
| Elderly family operators | Larger default text; predictable layouts; no hidden gestures |

---

## 5. Accessibility in testing (`TESTING.md`, `QA.md`)

| Level | What is checked |
| --- | --- |
| Unit | Formatters (`Rp`, dates), label generators |
| Browser tests (Vitest Browser Mode) | Component sizes, contrast tokens, keyboard interaction, focus order |
| E2E (Playwright) | Full operator journey at 360×640 with text zoom 130%, offline variants, screen-reader-visible labels |
| Manual QA | Sunlight test (literally outdoors), gloves test, one-hand test, speed test with a stopwatch |
| Content | Readability review of all operator-facing strings (short, imperative, jargon-free) |

**Manual QA is not optional** for the operator surface: the target environment cannot be fully
simulated (gloves, sun, noise, impatience).

---

## 6. Known limitations (honest statement)

1. Screen-reader support for a highly visual POS grid is imperfect; we mitigate with labels and
   an accessible list alternative rather than claiming full parity.
2. Do not assume the operator wants voice input; it is not a substitute for good tap design.
3. Very small screens (< 340 px) will show reduced tile columns; a degraded but usable layout
   exists, and is tested.
4. Low-end devices may not support Web Push; in-app alerts remain the fallback.
5. High-contrast mode is designed, not proven, until tested outdoors in the pilot — the pilot
   includes an explicit outdoor usability session.
