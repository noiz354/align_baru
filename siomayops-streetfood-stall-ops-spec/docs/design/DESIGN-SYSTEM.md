# Design System

**Document ID:** DOC-DESIGN-SYSTEM
**Status:** Phase 0 specification (tokens are declared in `src/shared/ui/tokens.ts`; no styles are implemented)
**Related:** `DESIGN.md`, `ACCESSIBILITY.md`, `docs/design/PAGES.md`, `src/shared/ui/*`

---

## 1. Principles that shape the system

1. **Legible at arm's length in daylight.** Large numerals, high contrast, minimal chrome.
2. **One thumb, one hand.** Primary actions sit in the lower third on operator surfaces.
3. **States, not surprises.** Offline, pending sync, waiting verification and stale data each have a
   defined visual treatment that never looks like a system error.
4. **Colour is never the only signal.** Text and shape carry the meaning; colour supports it.
5. **Honest money wording.** A waiting digital payment is always labelled "Menunggu verifikasi".
6. **Neutral differences.** Variance is "Selisih", never "Hilang"; the palette never renders an
   operator's honest report in alarm red.

## 2. Typography

| Token | Size / weight | Use |
| --- | --- | --- |
| `type.body` | 16 px / 400 | Default operator text |
| `type.secondary` | 14 px / 400 | Helper text, timestamps, notes |
| `type.label` | 14 px / 600 | Chips, buttons, table headers |
| `type.moneyLg` | 28 px / 700, tabular | Sale total, expected cash, variance |
| `type.moneyMd` | 20 px / 600, tabular | Line items, card figures |
| `type.heading` | 22 px / 700 | Screen titles |
| `type.caption` | 12 px / 500 | Sync state, device metadata (rare) |

Rules: tabular numerals for every amount; right-align amounts in tables; never truncate an amount —
wrap or reflow instead; system font stack only (no webfont download on the operator surface).

## 3. Spacing, layout and targets

| Token | Value | Use |
| --- | --- | --- |
| `space.1` | 4 px | Icon-to-label gap |
| `space.2` | 8 px | Inside chips, between related fields |
| `space.3` | 12 px | Card padding (compact, HQ) |
| `space.4` | 16 px | Card padding (operator), gutters |
| `space.6` | 24 px | Section separation |
| `tap.min` | 44 × 44 px | Absolute minimum for any control |
| `tap.pos` | 72 × 72 px | POS item tiles (name + price, both visible) |
| `radius` | 8 px tiles/cards · 999 px chips | — |

Operator layout rules: single column; bottom action bar for the current flow; no horizontal scroll
at 360 px; nothing critical within 8 px of a screen edge; sticky total while scrolling a cart.

## 4. Colour semantics

| Role | Intent | Applies to |
| --- | --- | --- |
| `ok` | Recorded and verified (`Tunai — selesai`, cash counted) | Success chip, verified badge |
| `waiting` | Waiting on something outside the operator's control (`Menunggu verifikasi`, pending sync) | Amber chip, sync pill |
| `neutral` | Not yet reported / informational | Grey chip, empty states |
| `attention` | Needs a human decision soon (review required, low stock) | Amber-strong card accent |
| `blocked` | Blocking condition (no price, validation error, forbidden) | Red, used sparingly |
| `safety` | Safety-critical incidents only | Distinct treatment + non-colour icon |

Explicit prohibition: red must never be applied to an operator's reported variance, an unexplained
`UNKNOWN` reason, or any honest self-report (NFR-UX-006). Contrast: text ≥ 4.5:1; large text and UI
boundaries ≥ 3:1; verified against the operator palette in browser tests.

## 5. Component inventory (shells exist in `src/shared/ui`)

| Component | Purpose | Required states | Task |
| --- | --- | --- | --- |
| `MoneyText` | Amount rendering with tabular numerals and currency rule | operator / HQ density; verified / waiting emphasis | T-FOUND-002 |
| `StatusBadge` | Status with tone + localised message id | neutral, ok, waiting, attention, blocked | T-FOUND-002 |
| `OfflineBanner` | Persistent offline state with pending count | offline, online-with-pending, reconnected | T-OFF-002 |
| `SyncStatePill` | Per-record sync state | LOCAL_ONLY, PENDING, SYNCING, SYNCED, REJECTED, DEFERRED | T-OFF-003 |
| `FreshnessBadge` | Age of a read model | current, recent, stale | T-HQ-003 |
| `TapTarget` | Enforces minimum target size | enabled, disabled | T-FOUND-002 |
| `ReasonChips` | Choose a reason instead of typing | unselected, selected, requires-note | T-FOUND-002 |
| Item tile (POS) | Sell an item in one tap | available, sold-out, unavailable-at-location, no-price | T-MENU-002 |
| Numeric keypad | Amount entry (cash, counts) | presets, exact-amount shortcut, validation error | T-SALE-002 |
| Queue row (Finance) | Verification item with evidence | pending, matched, short/over, disputed | T-PAY-004 |

Every component must define: idle, loading, empty, offline, error, and permission-denied rendering.

## 6. Motion

Fast and quiet: 120 ms for state feedback, 150 ms for panel transitions, no decorative animation,
respect `prefers-reduced-motion`, never animate an amount (money must never appear to change on its
own), never block interaction with an animation.

## 7. Content and localisation

- Bahasa Indonesia for operator surfaces; English for code and documentation.
- Currency `Rp10.000` (dot grouping, no decimals); dates `26/09/2026`; times `06.20`.
- All user-facing strings live in a per-surface content file keyed by message id — no inline
  sentence construction in components, and no error codes shown to operators (NFR-ACCESS-006).
- Chip labels (reasons, categories) come from configuration, never from code (ADR-0025).

## 8. Dark mode

Not a pilot requirement. If added: re-verify every contrast pair, re-check the amber "waiting" and
red "blocked" distinction, and re-run the visual regression suite in both schemes.

## 9. Accessibility checks that belong to the design system

Minimum contrast, tap size, focus visibility, non-colour status, 130% font scaling, screen-reader
labels, reduced motion, and no keyboard traps in the Finance queue — verified in browser tests
(`tests/browser/tap-budget.test.tsx`) and in `QA.md` scenario family QA-K.

## 10. What the design system deliberately does not include

Charts (read-model cards use tables and figures first), illustration libraries, icon fonts, webfonts,
animation frameworks, and any component whose only purpose is engagement (streaks, badges for usage,
activity heatmaps of people).
