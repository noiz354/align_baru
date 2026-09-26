/**
 * PHASE 0 — COMPONENT SHELL. Props are the contract; the render is intentionally absent and
 * throws so nothing can be mistaken for a working screen (ADR-0036, task T-FOUND-002).
 * Design rules live in DESIGN.md and docs/design/DESIGN-SYSTEM.md.
 */

/** STATUS must always be readable without colour (NFR-ACCESS-003) and never ambiguous
 *  about money: unverified digital payments read "Menunggu verifikasi" (FR-PAYMENT-006). */
export type StatusTone = "neutral" | "ok" | "waiting" | "attention" | "blocked";

export interface StatusBadgeProps {
  readonly tone: StatusTone;
  /** a localisation key, not a sentence: wording lives in one place per surface (DESIGN.md §11) */
  readonly messageId: string;
  readonly helpMessageId?: string;
}

export function StatusBadge(_props: StatusBadgeProps): never {
  throw new Error("Not implemented: T-FOUND-002");
}
