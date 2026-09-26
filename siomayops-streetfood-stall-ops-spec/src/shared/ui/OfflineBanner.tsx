/**
 * PHASE 0 — COMPONENT SHELL. Props are the contract; the render is intentionally absent and
 * throws so nothing can be mistaken for a working screen (ADR-0036, task T-FOUND-002).
 * Design rules live in DESIGN.md and docs/design/DESIGN-SYSTEM.md.
 */

/** Offline is a state, not an error: "Tanpa sinyal — penjualan tetap tercatat" (DESIGN.md §5). */
export interface OfflineBannerProps {
  readonly isOffline: boolean;
  readonly pendingRecordCount: number;
  readonly oldestPendingAgeSeconds?: number;
}

export function OfflineBanner(_props: OfflineBannerProps): never {
  throw new Error("Not implemented: T-OFF-002");
}
