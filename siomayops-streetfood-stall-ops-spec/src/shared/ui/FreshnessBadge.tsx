/**
 * PHASE 0 — COMPONENT SHELL. Props are the contract; the render is intentionally absent and
 * throws so nothing can be mistaken for a working screen (ADR-0036, task T-FOUND-002).
 * Design rules live in DESIGN.md and docs/design/DESIGN-SYSTEM.md.
 */

/** Every read model shows its age; stale values are labelled, never presented as current
 *  (FR-HQ-008, ARCHITECTURE.md §8). */
export interface FreshnessBadgeProps {
  readonly computedAt: Date;
  readonly band: "current" | "recent" | "stale";
}

export function FreshnessBadge(_props: FreshnessBadgeProps): never {
  throw new Error("Not implemented: T-HQ-003");
}
