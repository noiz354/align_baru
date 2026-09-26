/**
 * PHASE 0 — COMPONENT SHELL. Props are the contract; the render is intentionally absent and
 * throws so nothing can be mistaken for a working screen (ADR-0036, task T-FOUND-002).
 * Design rules live in DESIGN.md and docs/design/DESIGN-SYSTEM.md.
 */

/** Minimum 44x44 px, 72x72 px for POS tiles (NFR-ACCESS-001). Enforced by shell + visual tests. */
export interface TapTargetProps {
  readonly minSize: 44 | 72;
  readonly label: string;
  readonly disabled?: boolean;
}

export function TapTarget(_props: TapTargetProps): never {
  throw new Error("Not implemented: T-FOUND-002");
}
