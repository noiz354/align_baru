/**
 * PHASE 0 — COMPONENT SHELL. Props are the contract; the render is intentionally absent and
 * throws so nothing can be mistaken for a working screen (ADR-0036, task T-FOUND-002).
 * Design rules live in DESIGN.md and docs/design/DESIGN-SYSTEM.md.
 */

/** Per-record sync state must always be visible to the operator (NFR-OFFLINE-006). */
export type SyncState = "LOCAL_ONLY" | "PENDING" | "SYNCING" | "SYNCED" | "REJECTED" | "DEFERRED";

export interface SyncStatePillProps {
  readonly state: SyncState;
  readonly reasonMessageId?: string;
  readonly retryAfterSeconds?: number;
}

export function SyncStatePill(_props: SyncStatePillProps): never {
  throw new Error("Not implemented: T-OFF-003");
}
