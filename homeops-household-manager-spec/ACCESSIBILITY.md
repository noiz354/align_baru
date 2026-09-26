# ACCESSIBILITY.md — Accessibility Standard & Checklist

> 2026-09-26 · Status: **SPECIFIED, NOT IMPLEMENTED** · Target: **WCAG 2.2 level AA** for core journeys (NFR-A11Y-001).
> Rationale: this app is used one-handed in a kitchen, sometimes by older family members, sometimes in poor light. Accessibility here is usability for the actual users, not compliance theatre.

## 1. Scope & conformance target

| Aspect | Decision |
| --- | --- |
| Standard | WCAG 2.2 AA for: sign-in, household setup, `/today`, completing a chore, marking trash full, restocking, reporting an issue, acknowledging an alert, settings |
| Out of scope (documented) | Admin-only operator tooling that does not exist in the product UI |
| Testing layers | Automated (axe via Playwright/component tests) + manual keyboard pass + one screen-reader pass per slice (VoiceOver or NVDA) |
| Evidence | Per-UI-task checklist in the PR (ACCESSIBILITY.md §9) |

## 2. Keyboard & focus

| ID | Requirement |
| --- | --- |
| A-K1 | Every interactive element is reachable by `Tab` in visual order; no positive `tabindex`. |
| A-K2 | Focus is always visible: ≥ 3:1 contrast against adjacent colours, ≥ 2 px outline (or equivalent), never removed without an alternative. |
| A-K3 | Focus order follows visual order; after a mutation, focus stays or moves logically (never to `<body>`). |
| A-K4 | `Escape` closes any overlay/sheet and returns focus to the invoking control. |
| A-K5 | No keyboard traps; modals are focus-scoped with a documented return target. |
| A-K6 | Skip-to-content link is the first focusable element on pages with navigation. |
| A-K7 | Lists support expected key behaviour where they are lists (arrow navigation is not required, but link/button semantics are). |
| A-K8 | One-tap actions are real `<button>`s (not clickable `<div>`s) so keyboard and screen-reader users get the same affordance. |

## 3. Screen reader semantics

| ID | Requirement |
| --- | --- |
| A-S1 | One `<h1>` per page; headings nest without skipping levels. |
| A-S2 | Landmarks: `header`, `nav`, `main`, plus labelled sections for dashboard cards. |
| A-S3 | Lists are `<ul>/<ol>` with list items; counts are announced in text ("3 chores due today"), not only visually. |
| A-S4 | Status changes after an action are announced via `aria-live="polite"` (e.g. "Chore marked done. Undo available."). |
| A-S5 | Truly urgent, action-required messages use `role="alert"` sparingly (only `URGENT` alerts); everything else is polite. |
| A-S6 | Icons are `aria-hidden` when decorative; icon-only buttons have accessible names ("Mark toilet paper restocked"). |
| A-S7 | Status badges expose full meaning in text: "Bathroom: dirty, because deep clean is 2 days overdue" — never just a coloured dot. |
| A-S8 | Progress/loading states use `aria-busy` on the affected region and do not steal focus. |
| A-S9 | The staleness banner (ADR-014) is a `role="status"` region so it is announced when it appears. |
| A-S10 | Live regions are not used for high-frequency updates (avoids screen-reader flooding) — batched/aggregated where necessary. |

## 4. Colour, contrast & visual

| ID | Requirement |
| --- | --- |
| A-C1 | Text contrast ≥ 4.5:1 (normal) and ≥ 3:1 (≥ 24 px or ≥ 19 px bold). |
| A-C2 | Non-text UI boundaries (input borders, focus rings, icon glyphs conveying meaning) ≥ 3:1. |
| A-C3 | **Status is never colour alone**: every status pairs colour with a word and a shape/icon (DESIGN DP-11). |
| A-C4 | Information conveyed by position is also conveyed in text (e.g. "overdue" label, not just red. |
| A-C5 | Text remains readable at 200% zoom and in browser reader modes; no content clipped or overlapping. |
| A-C6 | Dark mode (DESIGN-SYSTEM.md#dark-mode) meets the same contrast ratios; token remap, not a second stylesheet. |
| A-C7 | Photos are decorative in lists; meaningful photos have alt text derived from the user's own description or are marked decorative. |

## 5. Touch, pointer & motor

| ID | Requirement |
| --- | --- |
| A-T1 | Touch targets ≥ 44×44 px with ≥ 8 px spacing between adjacent targets (NFR-A11Y-004). |
| A-T2 | Primary actions reachable one-handed on a 375 px viewport (lower third for `/today`). |
| A-T3 | No hover-only affordances; no drag-only interactions. |
| A-T4 | Destructive actions require an explicit confirmation but never a timed double-action (no "click twice in 3 seconds"). |
| A-T5 | Swipe gestures (if any) have a button equivalent; in v1 no swipe-only actions are planned. |
| A-T6 | Errors are not triggered by pointer precision (no tiny inline "x" as the only way to remove an item). |

## 6. Motion & timing

| ID | Requirement |
| --- | --- |
| A-M1 | `prefers-reduced-motion: reduce` disables transitions, skeleton shimmer, and auto-animations; state changes remain visible via static indicators. |
| A-M2 | No auto-playing animation longer than 5 s; no parallax. |
| A-M3 | Timeouts are avoidable/adjustable: the only timed flow is session expiry, which warns before expiring and preserves in-progress input where possible. |
| A-M4 | Undo windows (8 s snackbar) are also available via an alternative path (reopen completion), so timing is not a barrier. |
| A-M5 | Optimistic UI never hides a change from assistive tech — the live region announces the result. |

## 7. Forms & errors

| ID | Requirement |
| --- | --- |
| A-F1 | Every input has a programmatic label (visible `<label>` or `aria-label` with visible alternative). |
| A-F2 | Placeholders are never the only label. |
| A-F3 | Errors are announced (`aria-live`) and tied to fields via `aria-describedby`; invalid fields get `aria-invalid`. |
| A-F4 | Multi-field forms show an error summary at the top with links to the fields. |
| A-F5 | Required fields are marked in text, not only with colour or an asterisk alone. |
| A-F6 | Input purposes use appropriate `type`, `inputmode`, and `autocomplete` (e.g. `autocomplete="one-time-code"` for OTP, `inputmode="numeric"` for quantities). |
| A-F7 | Validation never discards user input on failure. |
| A-F8 | Error copy explains what to do (DESIGN §11), not just what went wrong. |

## 8. Alerts, notifications & dynamic content semantics

| Context | Required semantics |
| --- | --- |
| Alert card in a list | Ordinary list content with text stating type, subject, and expectation; no `role="alert"` spam |
| New `URGENT` alert while the page is open | `role="alert"` announcement once (not per re-render) |
| Action confirmation (chore done) | `role="status"` polite announcement with undo availability |
| Alert count badge in nav | Accessible name includes the count ("Alerts, 3 needing attention") |
| Push notification content | Mirrors the minimal payload rule (PRIVACY.md §8); tapping deep-links to the entity |
| Offline/staleness | `role="status"` region; not announced on every render |

## 9. Per-task accessibility checklist (paste into the PR)

```markdown
- [ ] Keyboard: full path to the action, visible focus, logical order
- [ ] Screen reader: names, roles, states correct; status announced politely
- [ ] Contrast: text ≥ 4.5:1, UI ≥ 3:1 (checked in both light and dark tokens)
- [ ] Status not colour-only (word + shape + colour)
- [ ] Touch targets ≥ 44×44 px on a 375 px viewport
- [ ] Reduced motion respected (no animation required to understand state)
- [ ] Forms: labels, error association, error summary where multi-field
- [ ] Empty/loading/error states reachable and announced correctly
- [ ] 200% zoom pass on the affected page
- [ ] axe run clean (no new violations) on the affected page
```

## 10. Known risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Status colours drift between features | Centralised `StatusBadge` primitive owns the word+shape+colour mapping (DESIGN CP-3) |
| Optimistic UI masking failures for screen-reader users | Announce the confirmed result, and announce failures as `role="status"` with the error text |
| Long activity lists overwhelming screen readers | Keyset pagination + "load more" button (never infinite scroll), so users control content flow |
| Small touch targets in dense desktop layouts | Desktop may be denser, but never below 32 px, and mobile is the design driver |
| Notification permission UI being inaccessible | Plain-language rationale page with a form control, not a browser-native surprise |
