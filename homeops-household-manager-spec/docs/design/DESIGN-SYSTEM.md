# Design System

> Implementation target: Tailwind v4 CSS-first theme (`@theme`) + a small set of hand-rolled primitives in `src/shared/ui`. No component library is used (ADR-003): the whole surface is ~20 components, and hand-rolling them keeps the bundle small and the accessibility behaviour ours to own.
> DESIGN.md is the doctrine; this file is the toolbox.

## 1. Principles applied to components

| Principle | Consequence for a component |
| --- | --- |
| One-hand, one-tap | Primary actions live in the lower 2/3 of the screen; touch targets ≥ 44 px; no hover-only affordances |
| Words before colour | Every state carries a word; colour and shape reinforce it |
| Calm by default | No animation on load, no badges that shout, no red unless a person must act |
| No scores, no ranking | Components must not be able to *express* a percentage of "done-ness" for a person or a home |
| Works without JavaScript | Server-rendered first; enhancement is progressive (forms post, then hydrate) |
| Fast on a cheap phone | Primitives ship no runtime deps, no icon fonts, no chart library |

## 2. Tokens (single source of truth)

All tokens are CSS custom properties declared in `@theme` and consumed as Tailwind utilities. Nothing may hard-code a hex value outside this file's token block.

```css
/* colour: semantic, not decorative
   Values below are the ones that pass `npm run verify:contrast` (T-PLAT-015). The original sketch
   values failed WCAG AA for status borders on white (attention 1.9:1, warning 2.4:1); each status
   colour was darkened to ≥3:1 and the dark theme lightens the same names to hold ≥3:1 there.
   See DECISIONS.md 2026-09-27 "design tokens adjusted to meet the contrast gate". */
--color-bg            oklch(0.99 0.005 250)   /* app background */
--color-surface       oklch(1    0    0)      /* cards, sheets */
--color-border        oklch(0.86 0.012 250)
--color-text          oklch(0.22 0.02 250)
--color-text-muted    oklch(0.45 0.02 250)
--color-primary       oklch(0.48 0.14 250)    /* actions the member takes */
--color-primary-fg    oklch(0.99 0 0)
--color-neutral       oklch(0.55 0.02 250)    /* unknown / inactive */
--color-success       oklch(0.52 0.13 150)    /* clean, done, available */
--color-attention     oklch(0.55 0.13 75)     /* needs attention, low */
--color-warning       oklch(0.53 0.15 55)     /* overdue, full, critical-ish */
--color-critical      oklch(0.50 0.20 25)     /* safety, unavailable, urgent */
--color-focus         oklch(0.45 0.16 250)    /* focus ring, ≥3:1 against surfaces */

/* spacing scale: 4px base */
--space-1 .25rem … --space-10 2.5rem
/* radius / type / shadow */
--radius-sm .375rem  --radius-md .5rem  --radius-lg .75rem  --radius-full 9999px
--text-xs .75rem --text-sm .875rem --text-base 1rem --text-lg 1.125rem --text-xl 1.375rem
--shadow-1 0 1px 2px rgb(0 0 0 / .06)  --shadow-2 0 2px 8px rgb(0 0 0 / .10)
```

| Rule | Why |
| --- | --- |
| Dark theme remaps the same token names, never a second stylesheet | One component, two themes |
| Contrast targets: text ≥ 4.5:1, large text ≥ 3:1, focus ring ≥ 3:1, status shapes ≥ 3:1 borders | WCAG 2.2 AA (ACCESSIBILITY.md) |
| `prefers-reduced-motion` removes all transitions except opacity ≤ 120 ms | Vestibular safety |
| Token contrast is asserted by a test script (T-A11Y-004) | Prevents drift |

## 3. Colour semantics (fixed mapping)

| Token | Meaning | Never used for |
| --- | --- | --- |
| `success` | Clean, done, collected, available, fully stocked | "Good member", streaks, praise |
| `attention` | Needs attention soon, low supply | Errors |
| `warning` | Overdue, full, critical supply | Blocking failure |
| `critical` | Safety risk, unavailable, urgent, action required now | Emphasis, marketing |
| `neutral` | Unknown, paused, archived, inactive | Disabled controls (which use opacity + `aria-disabled`) |

**Status is always word + shape + colour.** The shape vocabulary:

| Shape | Meaning | Example |
| --- | --- | --- |
| ● filled circle | OK / clean / done | Room CLEAN, resource FULL |
| ▲ triangle | Attention / needs a look soon | NEEDS_ATTENTION, LOW, ALMOST_FULL |
| ■ square | Overdue / blocked | DIRTY, FULL, overdue chore |
| ◆ diamond | Critical / urgent / safety | CRITICAL, UNAVAILABLE, SAFETY issue |
| ○ hollow circle | Unknown / no data | Room UNKNOWN, never-tracked |
| ▬ bar | In progress | CLEANING, IN_PROGRESS |

Shapes are rendered as inline SVG with `aria-hidden` and accompanied by text; a shape is never the only signal.

## 4. Type & layout

| Element | Spec |
| --- | --- |
| Base size | 16 px; never below 14 px for body, 12 px only for metadata |
| Line height | 1.5 body, 1.25 headings |
| Max line length | ~65 characters in content columns |
| Layout | Single column mobile-first; `md:` two columns (list + detail); `lg:` max-width 1024 px centred |
| Safe areas | `env(safe-area-inset-*)` respected for the bottom nav and sticky action bars |
| Zoom | Usable at 200% (tested, T-A11Y-003) |

## 5. Primitives (`src/shared/ui`)

| Component | Purpose | Notes |
| --- | --- | --- |
| `app-shell` | Nav, safe areas, skip-link, error boundary | Bottom nav ≤ 5 items: Today · Rooms · Chores · Alerts · More |
| `status-badge` | Word + shape + colour for every enum state | **The only place status colours live** (T-A11Y-002). Props: `status`, `size`, `withReason?` |
| `empty-state` | Illustration-free, one sentence + one action | Copy rules in DESIGN.md §17 |
| `error-surface` | Maps error classes E-1..E-7 to a shape | Inline banner / toast / blocking dialog / page-level |
| `section-header` | Title + optional count + optional action | Counts are words for small numbers ("3 items") |
| `quick-action` | One-tap button with undo | ≤ 3 per screen; never destructive without confirm+undo |
| `quantity-picker` | Mode-aware level chooser | Segmented chips; see INTERACTION-PATTERNS.md §3 |
| `snooze-picker` | Duration chips | Never a free-text date field |
| `reason-picker` | Enum chips + optional note | Used by skip, reset, resolve, wont-fix, delete |
| `confirm-dialog` | Destructive confirmation | Names the consequence, offers the safe path first |
| `toast` | Transient result with undo | `role="status"`, 8 s for undoable actions |
| `relative-time` | "2 h ago" with absolute on tap/expand | `<time datetime>`; no "in 3 minutes" false precision |
| `list-row` | Tappable entity row | Whole row is the target; secondary action is a real button |
| `skeleton` | Loading placeholder | Fixed heights to avoid layout shift; respects reduced motion |

In this phase only three primitives exist as skeletons - `app-shell`, `status-badge`, and `empty-state` - because ARCHITECTURE.md §9 restricts `src/shared/ui` to primitives that encode a cross-cutting rule (status semantics, shell/navigation, empty-state contract). The rest of the table is a **planned** catalogue: each is created with the first page that needs it, inside that feature, and promoted to `src/shared/ui` only when a second feature needs it.

Rules: primitives are presentation-only (no data fetching); props are typed with domain union types imported from `src/shared/types`, not re-declared; each primitive has a component test plus at least one a11y assertion.

## 6. Form controls & validation

- Labels always visible above the field (no placeholder-as-label).
- Validation messages appear inline, below the field, after blur or submit — never while typing the first character.
- Server validation is authoritative; the client mirrors it only for speed.
- Destructive/irreversible actions use `confirm-dialog`; recoverable ones use undo in a toast instead.
- Number inputs: steppers are fine for quantities, but the level picker is preferred for supplies (less typing).

## 7. Loading, empty, error, offline

| State | Treatment |
| --- | --- |
| Loading | Skeletons matching final layout, max ~300 ms before first paint of shell; no spinners on the dashboard's first paint |
| Empty (nothing to do) | Explicit all-clear ("You're all clear for today") — never a blank screen |
| Empty (never set up) | One action ("Add your first room") with a short rationale |
| Error E-1 (network) | "We couldn't reach HomeOps" + Retry; mutations surface a clear failed state |
| Error E-6 (stale/offline) | Staleness banner with the last-updated time; never silently show old data as current |
| Degraded (email off, push unsupported) | Quiet inline note in settings only — never on the dashboard |

## 8. Iconography & imagery

Inline SVG icons only (no icon font, no sprite CDN): shield, bell, trash, broom, box, wrench, camera, clock, check, alert, info, home, user. Icons always accompany a text label in navigation and primary actions; icon-only is allowed only for a recognised single action inside a dense row, and then it needs an accessible name and a 44 px hit area. No illustrations, no avatars with generated faces (initials only), no stock photos — the product shows **nothing** that pretends to know more than the household told it.

## 9. Component-level rules that protect the product's intent

1. No component may compute a score, percentage, streak, or ranking — including "invisible" ones used for sorting by "most productive".
2. No component may render a member's name next to a missed task in a way that reads as blame; the copy pattern is task-first ("Deep clean is 2 days overdue — assigned to Budi"), and only where the attribution helps coordination.
3. No notification surface may show content that the lock-screen redaction rules forbid (PRIVACY.md §8).
4. No component may auto-refresh in a way that discards the member's in-progress input.
5. Nothing animates on load; motion only communicates a state change the member caused.

## 10. Design-system change process

A change to a token, shape vocabulary, or primitive requires: a screenshot pair in the PR (light + dark), a contrast check, an a11y test run, and — for anything that alters status semantics — an update to DESIGN.md §13 and ACCESSIBILITY.md §6 in the same PR. New primitives need a stated use case from at least two features; otherwise they are local components.
