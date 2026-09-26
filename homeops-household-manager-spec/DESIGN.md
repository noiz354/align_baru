# DESIGN.md — HomeOps Product & UX Design

> Central product/UX design document · 2026-09-26 · Status: **DESIGN PHASE COMPLETE, NOT IMPLEMENTED**
> This document is normative for UI work in later slices. It defines *what* and *why*; `docs/design/DESIGN-SYSTEM.md` defines the visual vocabulary, `docs/design/PAGES.md` the page inventory, `docs/design/INTERACTION-PATTERNS.md` the behaviours.
> No component in this repository is implemented. See AGENTS.md#forbidden-actions.

## 1. What HomeOps should feel like

Six feelings, in priority order. If a design decision trades one for another, the higher one wins.

| # | Feeling | What it means in practice |
| --- | --- | --- |
| F-1 | **Calm** | The default state is quiet. Nothing scrolls, blinks, or nudges. Absence of alerts is information, not emptiness. |
| F-2 | **Trustworthy** | The screen answers "is this current?" honestly — timestamps on volatile things, staleness when offline, no fake precision. |
| F-3 | **Fast** | One tap for the common thing. The most frequent action (complete a chore) never requires a form, a modal chain, or a page navigation. |
| F-4 | **Lightweight** | It fits in a pocket-sized moment: kitchen, doorway, one hand. Screens are short; no infinite feeds. |
| F-5 | **Honest about people** | It tracks *work*, not *people*. No scores, streaks, or leaderboards (PRD NG-3). |
| F-6 | **Domestic, not corporate** | Warm, plain language. "Mark done", not "Close work item". No acronyms in user-facing copy. |

**Counter-feeling:** enterprise dashboards. If HomeOps ever shows a KPI band, a filter bar with 11 facets, or a chart nobody acts on, the design has failed.

## 2. Design principles

| ID | Principle | Concrete rule | Anti-pattern |
| --- | --- | --- | --- |
| DP-1 | **Actionability over completeness** | Every card either has an action or is explicitly informational (FR-DASH-002). | A "statistics" card with no next step. |
| DP-2 | **Clarity over density** | One primary idea per card; plain language; show the *next* thing, not the whole history. | 3-line summaries with counts of counts. |
| DP-3 | **Low friction over configurability** | Ship a good default; configuration is optional and lives in settings. | Onboarding wizards that must be completed to see anything. |
| DP-4 | **Low alert fatigue over immediacy** | One alert per real-world problem; grouping, dedupe, quiet hours, and caps are core, not extras (ALERTS.md). | "Notify all members on every change". |
| DP-5 | **Household privacy over convenience** | No analytics, no presence, minimal PII in logs; photos are opt-in per action (PRIVACY.md). | "See who's home". |
| DP-6 | **Mobile first over desktop parity** | Design the 375 px case; desktop is a comfortable re-flow, not a different product. | Desktop-only tables as primary UI. |
| DP-7 | **Simple maintenance over feature depth** | New capability must fit an existing page and interaction pattern, or it is rejected. | A new settings area per feature. |
| DP-8 | **Visible accountability over shame** | Show who did what and who owns what, neutrally. | Red "you missed this" language; per-person counters. |
| DP-9 | **No fake precision** | Approximate when the truth is approximate: "Enough", "Low", not "38% remaining". | Invented numeric cleanliness or stock percentages. |
| DP-10 | **Reversible and forgiving** | Destructive actions are confirmable and undoable where cheap; completion can be corrected. | Silent hard deletes. |
| DP-11 | **Recognisable at a glance** | Status uses a consistent word + shape + colour triad (DESIGN-SYSTEM.md#status-semantics). | Colour-only meaning. |
| DP-12 | **Honest about time** | Relative times ("2h ago", "tomorrow") with absolute time on tap/expand; household timezone always. | Ambiguous "Yesterday" across midnight boundaries. |

## 3. Information hierarchy

Ranked by what a member must be able to answer, most urgent first. This ordering is the backbone of `/today` and of every page's structure (FR-DASH-001).

| Rank | Question | Surface | Priority vocabulary |
| --- | --- | --- | --- |
| H-1 | "Is anything wrong / unsafe right now?" | Urgent alerts strip (safety issues, critical resources) | `URGENT`, `IMPORTANT` |
| H-2 | "What must happen today?" | Due-today list | `CHORE_DUE`, `TRASH_COLLECTION_DUE`, `MAINTENANCE_DUE` |
| H-3 | "What have we missed?" | Overdue list (quiet, never scolding) | `CHORE_OVERDUE`, `MAINTENANCE_OVERDUE` |
| H-4 | "What can I do in one tap?" | Quick actions | — |
| H-5 | "How is the house doing?" | Room status rows | room states |
| H-6 | "What do we need to buy?" | Low supplies | `LOW`, `CRITICAL`, `EMPTY` |
| H-7 | "What's coming?" | Upcoming maintenance + next 7 days | informational |
| H-8 | "What happened recently?" | Recent activity (5 items + link) | informational |
| H-9 | "Who is in this household?" | Members page | informational |

**Rule:** a page never places lower-ranked information above higher-ranked information. Detail pages may invert this (a chore detail is *about* that chore), but list and dashboard surfaces may not.

## 4. Navigation

```text
App shell (mobile: bottom bar / desktop: left rail)
├── Today          /today        ← default landing after auth
├── Rooms          /rooms
├── Chores         /chores
├── Trash          /trash
├── Resources      /resources
├── Maintenance    /maintenance
├── Issues         /issues
├── Alerts         /alerts
├── Activity       /activity
└── Settings       /settings  (household, members, notifications, preferences, data)
```

| Rule | Detail |
| --- | --- |
| N-1 | Bottom bar has **5 slots max**: Today, Rooms, Chores, Alerts (with count badge), More. Everything else lives in More. |
| N-2 | Alerts badge shows only `OPEN` + `URGENT/IMPORTANT` counts; informational alerts never badge. |
| N-3 | Deep link for anything actionable: every alert, occurrence, and issue has a stable URL (shareable between members). |
| N-4 | Back always returns to the originating surface, preserving scroll and filter state where cheap. |
| N-5 | `/` is a public landing/redirect: signed-in → `/today`; signed-out → `/login`. |
| N-6 | Settings are the only place with sub-navigation; everything else is at most two levels deep. |
| N-7 | No hamburger menus, no nested drawers, no modal navigation stacks. |

## 5. Page structure

Uniform skeleton so the product stays learnable:

```text
┌─ App bar: <page title>                     [primary action(s)]
├─ Status strip (only when something needs attention)   ← optional, ranked H-1/H-2
├─ Primary list / grid (the page's job)
├─ Secondary section (filters, archive, history)        ← collapsed on mobile
└─ Bottom nav (mobile)
```

| Rule | Detail |
| --- | --- |
| P-1 | At most **one** primary action per page in the app bar. |
| P-2 | Lists are ordered by urgency, then due time, then creation time — deterministic, documented per page in docs/design/PAGES.md. |
| P-3 | Every list item is tappable as a whole; inline actions are secondary and never the only way. |
| P-4 | Filters are never required to see something meaningful. |
| P-5 | Detail pages lead with status + the action; metadata ("created by", notes) follows. |
| P-6 | History is always at the bottom of a detail page, collapsed beyond 5 entries. |

### 5.1 Dashboard priority (summary — full spec in docs/product/DASHBOARD.md)

Cards in fixed order: **1. Attention strip (IMPORTANT/URGENT alerts) → 2. Overdue → 3. Due today → 4. Quick actions → 5. Room status → 6. Low supplies → 7. Maintenance and upcoming → 8. Recent activity.** Overdue precedes Due today because a missed thing outranks a scheduled one. Cards with nothing to say are hidden (not shown empty), except the explicit "All clear" state. `docs/product/DASHBOARD.md` is normative if this summary ever drifts from it; the order is not configurable (DP-6).

## 6. Responsive behavior

| Breakpoint | Width | Layout | Navigation | Notes |
| --- | --- | --- | --- | --- |
| `xs` (default) | 0–479 px | Single column, 16 px gutter, full-bleed lists | Bottom bar (5 slots) | Primary target. Sticky bottom-safe-area padding. |
| `sm` | 480–767 px | Single column, 24 px gutter | Bottom bar | Cards may sit 2-up only for compact status chips. |
| `md` | 768–1023 px | 2-column card grid for status surfaces; lists stay single column | Side rail (icon+label) | Tablet in kitchen context. |
| `lg`+ | ≥ 1024 px | Content column max 1100 px, centered; secondary panel for detail (master–detail) | Side rail | Desktop is a convenience surface, never the design driver. |

| Rule | Detail |
| --- | --- |
| R-1 | No horizontal scrolling for content (only for deliberately scrollable chip rows). |
| R-2 | Touch targets ≥ 44×44 px at `xs`; mouse-only affordances are forbidden. |
| R-3 | One-handed reach: primary action of `/today` sits in the lower third on mobile. |
| R-4 | Text ≥ 16 px body at `xs` to prevent iOS zoom on focus. |
| R-5 | Layout must survive 200% browser zoom without loss of function. |
| R-6 | Respect safe areas (`env(safe-area-inset-*)`) for bottom nav and sticky actions. |

## 7. Interaction patterns

Full catalogue in `docs/design/INTERACTION-PATTERNS.md`. The canonical set:

| Pattern | Used for | Shape | Rules |
| --- | --- | --- | --- |
| **One-tap complete** | Chore occurrence, maintenance service | Direct action on a list row / card, optimistic | Shows undo; records actor; idempotent (FR-CHORE-005) |
| **Level picker** | Resource level update | 3–5 segmented choices in a popover/sheet | Never a slider; never a text field; includes "used one" |
| **State stepper** | Trash container state | Sequential buttons (Almost full → Full → Collected) | Forward actions prominent, reset explicit |
| **Report in 20 s** | New issue | Title + optional photo, everything else defaulted | Photo prompt is a button, not a gate |
| **Assign/claim** | Chore occurrence, issue, collection | Two-tap: Assign → member list; "Claim" shortcut | Assignment is a commitment, shown with the member's name |
| **Snooze** | Alert, occurrence | Duration chips (1h, tonight, tomorrow, this weekend) | Always bounded; snooze is recorded and visible |
| **Acknowledge** | Alert | Single tap that stops escalation | Distinct from resolve; says "I've got this" |
| **Quick action row** | Dashboard | 4 chips: Complete, Trash, Restock, Report | Only renders actions that are currently valid |
| **Undo snackbar** | Any optimistic mutation | 8 s window | Undo reverses the domain record, not just the UI |

## 8. Feedback states

Every user action gets exactly one of these, and never a silent failure:

| State | Visual | Copy pattern | Rules |
| --- | --- | --- | --- |
| **Optimistic success** | Row enters completed state, subtle check | "Done — Nice." (short, no exclamation spam) | Only for idempotent, low-risk actions; pairs with undo |
| **Confirmed success** | Toast/snackbar | "Collected. Trash alert cleared." | States the consequence, not just the verb |
| **Partial success** | Inline note on the item | "Marked done. Photo didn't upload." | Never blocks the domain change (FR-NOTIF-008 analogue for uploads) |
| **Rejected** | Field- or item-level error | "Only an owner can remove members." | Explains the rule, not the status code |
| **Needs conflict resolution** | Item flagged, choice offered | "Someone already completed this 3 min ago. Keep both?" | Optimistic concurrency: last-write-wins is *never* silent |

## 9. Empty states

Empty is a design state, not a bug. Rules: state what is true, offer one action, never make it feel like failure.

| Surface | Empty copy intent | Action offered |
| --- | --- | --- |
| `/today` (nothing at all) | "All clear. Nothing needs you right now." | Add a chore / adjust settings |
| `/today` (nothing today, something later) | "Nothing due today. Next: <chore> on Thursday." | View schedule |
| Rooms (no rooms) | "No rooms yet." | Add a room |
| Chores (no chores) | "No chores yet." | Add a chore |
| Trash (no containers) | "No trash containers yet." | Add a container |
| Resources (none low) | "Everything's stocked." | View all resources |
| Maintenance (nothing due) | "No maintenance due." | Add an asset or plan |
| Issues (none) | "No open issues." | Report an issue |
| Activity (none) | "Nothing has happened yet." | — (no action) |
| Alerts (none) | "No alerts." | — |
| Partial: single card empty | Card hidden entirely | — |

## 10. Loading states

| Context | Rule |
| --- | --- |
| L-1 | Show skeletons matching final layout geometry, not spinners, for page-level loads. |
| L-2 | Server-rendered pages must stream: shell + status strip first, then card sections (PERFORMANCE.md). |
| L-3 | Any operation > 300 ms shows inline progress on the *item*, not a blocking overlay. |
| L-4 | Never block navigation to show a loading state that could have been streamed. |
| L-5 | Skeletons must not animate under `prefers-reduced-motion`. |
| L-6 | Optimistic actions never show a spinner on the item they already updated. |

## 11. Error states

| Class | Example | Behaviour |
| --- | --- | --- |
| E-1 Network/offline | No connection while marking done | Inline "Couldn't save. Retry" with the action preserved; no silent queue (FR-PWA-004) |
| E-2 Authorization | Helper tries to remove a member | Explain the rule; hide the control in the UI, enforce server-side |
| E-3 Validation | Chore with due date in the past | Field-level message in plain language; keep entered values |
| E-4 Conflict | Concurrent completion | Show both records and let the member choose; never discard silently |
| E-5 Unexpected (5xx) | Server error | Friendly page with retry + a short reference ID (correlation id) for the operator; never a stack trace |
| E-6 Stale data | Cached `/today` from offline shell | Visible "Last updated 2h ago — refresh" banner; do not present stale as current |
| E-7 Partial failure | Push subscription fails after saving alert | Domain change stands; a dismissible note explains the delivery gap |

Error copy rules: say what happened, what it means, what to do next; no error codes in user copy except the reference ID; no blaming the user.

## 12. Mobile behaviour

| Aspect | Rule |
| --- | --- |
| Install | Install prompt is offered after the second meaningful session, never on first load (FR-PWA-001). |
| Push | Permission is requested only after the member explicitly enables a channel in settings (never on load). |
| One-handed use | Primary actions in thumb zone; destructive/rare actions at the top or behind a menu. |
| Interruptions | Every mutation is idempotent, so a killed app mid-action does not corrupt state. |
| Camera | Photos are optional and compressed client-side; never a hard requirement for reporting (PRD A-3). |
| Offline | Shell + last-known `/today` marked stale; mutations fail loudly and retryably (ADR-014). |
| App-switching | Return to app restores position; no full reload on visibility change. |
| Text input | Minimal typing: defaulted titles, member pickers, duration chips; keyboard rarely required. |
| Safe areas | Sticky action bars respect `env(safe-area-inset-bottom)`. |
| Notifications | Tapping a push deep-links to the exact entity and its action (N-3). |

## 13. Accessibility (summary — full spec in ACCESSIBILITY.md)

| Aspect | Requirement |
| --- | --- |
| Standard | WCAG 2.2 AA for core journeys (NFR-A11Y-001) |
| Keyboard | Full operability; focus visible; focus order follows visual order; escape closes overlays; no keyboard traps |
| Screen reader | Semantic landmarks, one `h1` per page, list semantics for lists, `aria-live="polite"` for async confirmations, `role="status"`/`alert` distinctions |
| Status | Word + shape/icon + colour, always (NFR-A11Y-003) |
| Touch | ≥ 44×44 px (NFR-A11Y-004) |
| Contrast | ≥ 4.5:1 text, ≥ 3:1 non-text boundaries, ≥ 3:1 focus indicator (NFR-A11Y-005) |
| Motion | `prefers-reduced-motion` removes transitions, keeps state changes visible (NFR-A11Y-006) |
| Forms | Programmatic labels, error text tied via `aria-describedby`, errors summarised at the top for multi-field forms (NFR-A11Y-008) |
| Time | Never rely on colour/position alone for "due today vs overdue" — use words |

## 14. Design tokens (normative names)

Tokens are **CSS custom properties** (Tailwind v4 CSS-first configuration — see docs/research/STACK-2026.md#2). Full values in docs/design/DESIGN-SYSTEM.md.

| Group | Token names (non-exhaustive) |
| --- | --- |
| Colour (semantic) | `--color-neutral-*`, `--color-success-*`, `--color-attention-*`, `--color-warning-*`, `--color-critical-*`, `--color-disabled-*`, plus `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-text`, `--color-text-muted` |
| Status mapping | `--status-neutral`, `--status-success`, `--status-attention`, `--status-warning`, `--status-critical`, `--status-disabled` (each with `-fg`, `-bg`, `-border`) |
| Spacing | `--space-1..12` (4 px base scale) |
| Radius | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill` |
| Elevation | `--elev-0..3` (subtle; shadows are restrained) |
| Typography | `--font-sans`, `--font-mono`, `--text-xs..2xl`, `--leading-tight/normal/relaxed` |
| Motion | `--duration-fast` (120 ms), `--duration-base` (200 ms), `--ease-standard` |
| Layout | `--content-max`, `--gutter-xs/sm/md` |

Rules: no raw hex values in components; no token invented inside a feature module; dark mode is a token remap, not a second stylesheet (DESIGN-SYSTEM.md#dark-mode).

## 15. Layout rules

| Rule | Detail |
| --- | --- |
| LY-1 | Cards are the unit of dashboard composition; each card maps to exactly one information-hierarchy rank (H-1..H-9). |
| LY-2 | Card height is content-driven; never fixed to create visual symmetry. |
| LY-3 | Max two levels of visual nesting inside a card. |
| LY-4 | Lists use density `comfortable` on mobile, `compact` on desktop ≥ `lg`; the same data, not different data. |
| LY-5 | Sticky elements are limited to app bar and primary action bar; nothing else sticks. |
| LY-6 | Empty space is intentional calm, not a failure to fill (F-1). |
| LY-7 | Grid gaps use `--space-4` on mobile, `--space-5/6` at `md`+. |
| LY-8 | No full-width dividers between list rows on mobile; use spacing and subtle borders only where grouping changes. |

## 16. Component principles

| ID | Principle | Rationale |
| --- | --- | --- |
| CP-1 | Components are **presentational**; they receive data via props and never fetch. | Keeps features testable, keeps server/client boundary explicit (ARCHITECTURE.md#module-architecture) |
| CP-2 | A component owns exactly one interaction pattern from §7. | Prevents 12-variant "smart card" sprawl |
| CP-3 | Status rendering is centralised (`StatusBadge`-style primitive); no feature renders its own status chip. | Guarantees the word+shape+colour triad and AA contrast |
| CP-4 | Actions are declared as data (`{ kind, label, onAction }`), so the same card can be rendered read-only. | Enables the archived/read-only household state (FR-HH-010) |
| CP-5 | Every interactive component is keyboard-operable and exposes an accessible name before it is considered done. | NFR-A11Y-002 |
| CP-6 | Client components are opt-in (`"use client"`) and exist only where interactivity demands it. | PERFORMANCE.md#bundle-budget |
| CP-7 | No component knows about tenancy; the household boundary is enforced above them. | Prevents accidental cross-household rendering paths |
| CP-8 | Skeletons and empty states ship *with* the component, not later. | DESIGN §9, §10 are part of the contract |

## 17. Cross-cutting content & tone rules

| Rule | Detail |
| --- | --- |
| T-1 | Second person, present tense: "Mark done", "Nothing due today." |
| T-2 | No blame: "Not done yet" (not "Overdue by you"); overdue copy is neutral and factual. |
| T-3 | No exclamation marks; no gamification language. |
| T-4 | Numbers are stated only when known: "3 chores", "Enough", "Low". |
| T-5 | Times are household-local and relative first, absolute on demand. |
| T-6 | Buttons state outcomes ("Mark collected") over mechanisms ("Submit"). |
| T-7 | All strings live in one module for future localisation (PRD §2). |

## 18. What this document forbids

1. Numeric cleanliness scores, health scores, or "productivity" metrics for people (DP-9, PRD NG-3).
2. Colour-only status (DP-11).
3. Broadcast notifications (DP-4).
4. Presence/location features (DP-5, PRD NG-7).
5. Charts without an attached action (DP-1).
6. Blocks of configuration required before first value (DP-3).
7. Feature-specific design tokens or one-off components that duplicate an existing principle (CP-3, DP-7).
8. Any UI implying enterprise provenance: work orders, approvals, SLAs, Gantt views (ADR-012).
