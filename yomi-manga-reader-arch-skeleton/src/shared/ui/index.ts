/**
 * shared/ui — presentational primitives + design tokens (leaf layer).
 *
 * Rules:
 * - Tokens are the ONLY place colors/spacing/typography are defined
 *   (T-FOUND-004); contrast ≥ 4.5:1 text / 3:1 UI in light+dark
 *   (NFR-A11Y-008, CI-verified).
 * - Components are presentational: no data logic, no feature imports
 *   (boundary rule D8), no fetches.
 * - Every interactive primitive ships with: visible focus (NFR-A11Y-006),
 *   label support, ≥ 44×44 px touch target (NFR-A11Y-010),
 *   reduced-motion-safe transitions (NFR-A11Y-007).
 *
 * Planned inventory (T-FOUND-004): Button, Link, FormField, Dialog
 * (focus-trapped, NFR-A11Y-003), List, EmptyState, Skeleton, Badge,
 * Toast/Notice, AppShell (below).
 *
 * No production UI is built in the architecture phase.
 */
export * from './AppShell';
