# ACCESSIBILITY.md

Date: 2026-09-26 · Target: **WCAG 2.1 AA** (NFR-A11Y-001). This is a hard commitment, not a best-effort: every vertical slice exit includes an a11y check (axe-core in E2E + manual pass), and GA is gated on M-5 (Lighthouse a11y ≥ 95).

## 1. Scope

All public routes, all auth flows, the reader (all modes × both directions), admin panel, and error/empty states.

## 2. Structural Contract (NFR-A11Y-004)

- Landmarks: `header` (site nav), `main` (one per page), `nav` for chapter lists, `aside` for filters.
- One `h1` per page (title / manga title / chapter title); heading levels never skip.
- Chapter lists are real `ul`/`ol` with `li`; catalog grid items are links with descriptive accessible names ("{title} — manga, {status}").
- Forms: every input has a visible `<label>`; errors are linked via `aria-describedby` and announced (`role="alert"`); fieldsets for radio groups (reader preferences).

## 3. Reader Accessibility Contract (the hard part)

The reader must be usable with **keyboard alone** (NFR-A11Y-002) and with a screen reader (NFR-A11Y-009).

### 3.1 Keyboard Map (per mode; full spec in docs/product/reader-behavior.md §9)

| Key | Vertical | Single/Double |
|---|---|---|
| `ArrowDown` / `PageDown` / `Space` | scroll down one viewport | next page |
| `ArrowUp` / `PageUp` / `Shift+Space` | scroll up | previous page |
| `Home` / `End` | first / last page | first / last page |
| `←` / `→` | (direction-aware: in RTL, Right = previous) | previous / next (direction-aware) |
| `+` / `−` / `0` | zoom in / out / reset | same |
| `F` | fullscreen toggle | same |
| `M` | mode cycle (vertical → single → double) | same |
| `Esc` | exit fullscreen / close dialogs | same |

- All keys also have **visible, focusable button equivalents** (reader chrome: prev/next, mode, direction, zoom, fullscreen) — tap zones are not the only path (NFR-A11Y-006/010).
- The reader container receives initial focus on route entry (NFR-A11Y-003) and traps focus when chrome dialogs (mode picker) are open; focus returns to the container on close.

### 3.2 Screen-Reader Contract (NFR-A11Y-009)

- Page images: `alt="Page {n} of {M}"` (NFR-A11Y-005); cover: `alt="Cover: {title}"`.
- A polite `aria-live` region announces: page changes in paged modes ("Page 12 of 240"), chapter completion ("Chapter completed"), and mode/direction changes.
- Vertical mode: the live region announces every 10 pages + completion (per-page announcements in a long scroll are noise — documented exception, NFR-A11Y-009).
- Reader chrome controls have explicit `aria-label`s ("Next page", "Previous page", "Reading mode: vertical", "Zoom 150%").

### 3.3 Motion & Perception (NFR-A11Y-007/008)

- `prefers-reduced-motion`: disables smooth-scroll animation, swipe inertia, and chrome transitions; page turns become instant.
- Contrast ≥ 4.5:1 text / 3:1 UI in light **and** dark (theme tokens defined in VS-0, `src/shared/ui`; audited in CI with a token contrast check, T-FOUND-004).
- No information conveyed by color alone (e.g., "unread" = icon + count, not dot color only).
- Touch targets ≥ 44×44 px (NFR-A11Y-010), including reader chrome and tap-zone *keyboard equivalents*.

## 4. Navigation & Wayfinding

- Skip-to-content link on every page (first focusable element).
- Breadcrumbs on detail/chapter pages (Home / {title} / Chapter N).
- Reader position indicator (FR-READER-022) is exposed as text (`Page 12 of 240`) — not just a bar — and is the live-region source of truth.
- Next/previous chapter links are labeled ("Next: Chapter 12") with the target title.

## 5. Forms (auth, admin, search)

- Search input: labeled, `type="search"`, debounced (NFR-A11Y: debounce must not drop rapid typing — the last input always wins; keyboard users can press Enter to force immediate search, FR-SEARCH-005).
- Error summaries at top of form, linked, focusable (NFR-A11Y-003).
- Password field: reveal toggle labeled; password policy announced via `aria-describedby`.

## 6. Error & Empty States

- Every error page has: human cause, what the user can do, a link home. Error pages are focusable and announced.
- Empty states (no search results, empty library) are informative and offer the next action (NFR-A11Y: never a blank `main`).

## 7. Verification Plan

| Check | Tool/Method | Frequency |
|---|---|---|
| Automated violations | axe-core via Playwright `@axe-core/playwright` on every E2E route (incl. reader mid-state) | every CI run (T-FOUND-011 wiring; per-slice E2E) |
| Keyboard-only pass | Manual: full journey J-1…J-6 keyboard-only | each slice exit (ROADMAP manual verification) |
| Screen-reader pass | Manual: NVDA (Windows/Chromium) + VoiceOver (macOS/Safari) on reader + catalog + auth | VS-2, VS-4, VS-9, GA (gate M-5) |
| Contrast | Token-level CI check + Lighthouse | every CI run |
| Focus audit | E2E asserts: initial focus, trap, restore | reader E2E (E2E-READER-017) |
| Reduced motion | E2E with `emulateMedia({ reducedMotion: 'reduce' })` asserts no animated transitions | VS-4 |

**Residual (documented):** manga page images have no text content to read (they *are* the content); screen-reader users of image-only comics get page position + structure, not page content — inherent to the medium; no v1 mitigation (OCR is out of scope, NO-7).
