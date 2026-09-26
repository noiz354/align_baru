/**
 * PHASE 0 — COMPONENT SHELL. Props are the contract; the render is intentionally absent and
 * throws so nothing can be mistaken for a working screen (ADR-0036, task T-FOUND-002).
 * Design rules live in DESIGN.md and docs/design/DESIGN-SYSTEM.md.
 */

/** Reasons are chosen, not typed; "Lainnya" is the only free-text path (NFR-UX-003).
 *  Chip labels are configuration/data, never hard-coded lists (ADR-0025). */
export interface ReasonChip {
  readonly code: string;
  readonly labelMessageId: string;
  readonly requiresNote?: boolean;
}

export interface ReasonChipsProps {
  readonly chips: readonly ReasonChip[];
  readonly selectedCode?: string;
  readonly onSelect?: (code: string) => void;
}

export function ReasonChips(_props: ReasonChipsProps): never {
  throw new Error("Not implemented: T-FOUND-002");
}
