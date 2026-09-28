/**
 * shared/ui — presentational primitives + design tokens (leaf layer).
 *
 * Rules:
 * - Tokens are the ONLY place colors/spacing/typography are defined
 *   (T-FOUND-004); contrast ≥ 4.5:1 text / 3:1 UI in light+dark
 *   (NFR-A11Y-008, CI-verified by `node scripts/check-token-contrast.mjs`).
 * - Components are presentational: no data logic, no feature imports
 *   (boundary rule D8), no fetches.
 * - Every interactive primitive ships with: visible focus (NFR-A11Y-006),
 *   label support, ≥ 44×44 px touch target (NFR-A11Y-010),
 *   reduced-motion-safe transitions (NFR-A11Y-007).
 *
 * Inventory (T-FOUND-004). Each entry is a documented skeleton: the element,
 * its semantics and its token references are real; the behaviour a feature
 * owns is left as a TODO naming the task that owns it.
 *   AppShell    — landmarks + skip link (the page frame)
 *   Button      — native <button>, default + primary variants
 *   Link        — next/link with the token classes
 *   FormField   — label + control + hint + error, aria-wired
 *   Dialog      — native <dialog> (focus trap from the platform)
 *   ItemList    — real ul/ol + li
 *   FocusRegion — initial focus for not-found / error states
 *   StateRegion — the one "something went wrong / not built yet" shape, so a page is
 *                 never a blank main (ACCESSIBILITY.md §6)
 *   classNames  — the one class-list assembly helper (T-CATALOG-003/004/005/006/008)
 *
 * Stylesheets are imported by the root layout, not by the components:
 *   tokens.css — every colour in the product (the only place they are written)
 *   base.css   — the shell and the primitive classes, tokens only
 *
 * No production UI is built in the architecture phase.
 */
export * from './AppShell';
export * from './Button';
export * from './classNames';
export * from './Dialog';
export * from './FocusRegion';
export * from './FormField';
export * from './Link';
export * from './List';
export * from './StateRegion';
export * from './hydration';
