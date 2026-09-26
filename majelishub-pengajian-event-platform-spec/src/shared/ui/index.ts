/**
 * Shared UI primitives (design system implementation home).
 *
 * Where this belongs: `src/shared/ui/` - the only place generic components live. Feature components go
 * in `src/features/<feature>/ui/`.
 * Specification: docs/design/DESIGN-SYSTEM.md (tokens, typography, density, states), DESIGN.md
 * (SIMPLE, RESPECTFUL, CALM, MOBILE FIRST, FAST AT THE ENTRANCE, ACCESSIBLE, LOW FRICTION,
 * INFORMATION FIRST).
 *
 * Phase 0: no components exist. The rule is that a shell renders nothing (`return null`) plus a
 * `TODO(taskId)` - placeholder UI that could be mistaken for the product is forbidden.
 * Accessibility is a build-time concern, not a later pass: every primitive must state its focus,
 * target size (>= 56 px for primary actions on mobile), and live-region behaviour when it lands.
 *
 * TODO(T-ARCH-001): tokens file (`src/app/styles/tokens.css`) plus primitives: Button, Field, Badge,
 *   Notice, Sheet, LiveRegion, CodeDisplay (large-text mode), ArabicText (bidi-safe).
 */
export {};
