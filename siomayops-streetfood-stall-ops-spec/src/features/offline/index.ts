/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Offline is a first-class state (OFFLINE.md, ADR-0017): client outbox with per-aggregate FIFO,
 * encrypted at rest, wiped on logout; server applies batches idempotently with per-record results.
 * Nothing is ever silently dropped, and no digital payment may be replayed as successful (ADR-0033).
 */
import type { SyncRecordResult } from "../../shared/contracts/sync";

export type OfflineAggregate =
  | "shift" | "location_report" | "sale" | "payment_cash" | "expense" | "stock_report"
  | "incident" | "closing";

export interface OutboxRecord {
  readonly aggregate: OfflineAggregate;
  readonly clientId: string;
  readonly sequence: number;
  readonly payload: unknown;
  readonly recordedAtDevice: Date;
  readonly syncState: "LOCAL_ONLY" | "PENDING" | "SYNCING" | "SYNCED" | "REJECTED" | "DEFERRED";
  readonly reasonCode?: string;
}

export interface Outbox {
  enqueue(record: OutboxRecord): Promise<void>;
  pending(): Promise<readonly OutboxRecord[]>;
  markResult(clientId: string, result: SyncRecordResult): Promise<void>;
  wipe(): Promise<void>;
}

/** Throws. Task: T-OFF-001. Client-side queue (IndexedDB, encrypted). */
export function createOutbox(): Outbox {
  throw new Error("Not implemented: T-OFF-001");
}

/** Throws. Task: T-OFF-001. Server-side batch application with per-record outcomes. */
export async function applySyncBatch(_input: {
  organizationId: string; actorId: string; batch: unknown;
}): Promise<{ readonly results: readonly SyncRecordResult[] }> {
  throw new Error("Not implemented: T-OFF-001");
}

/** Throws. Task: T-OFF-003. Unresolvable conflicts are quarantined for a human, never dropped. */
export async function quarantineConflict(_input: {
  organizationId: string; clientId: string; conflictCode: string; detail: string;
}): Promise<{ readonly quarantineId: string }> {
  throw new Error("Not implemented: T-OFF-003");
}

/** Throws. Task: T-OFF-004. Bands: current <5 min, recent 5–60 min, stale >60 min. */
export function classifyFreshness(_computedAt: Date, _now: Date): "current" | "recent" | "stale" {
  throw new Error("Not implemented: T-OFF-004");
}
