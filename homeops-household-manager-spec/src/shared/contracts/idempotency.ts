// HomeOps — idempotency contract (docs/api/CONVENTIONS.md §5, AP-8).
//
// Every mutation a member might double-tap carries a `clientRequestId`. The key is stored per
// household for 24 h with the resulting entity id and status; a replay returns the *original*
// outcome with `meta.deduped = true` instead of duplicating a row.

import type { Id } from '../types';

export type IdempotencyBeginResult =
  /** No key yet: the caller may proceed and must `commit` inside the same transaction. */
  | { readonly status: 'NEW' }
  /** The original completed: replay its result, do not run the mutation again. */
  | { readonly status: 'REPLAY'; readonly entityKind: string | null; readonly entityId: Id | null }
  /** Another request is mid-flight (double submit across tabs): refuse with CONFLICT. */
  | { readonly status: 'IN_FLIGHT' };

export type IdempotencyStore = {
  begin(input: {
    readonly householdId: Id;
    readonly clientRequestId: Id;
    readonly operation: string;
    readonly now: Date;
  }): Promise<IdempotencyBeginResult>;
  commit(input: {
    readonly householdId: Id;
    readonly clientRequestId: Id;
    readonly operation: string;
    readonly entityKind: string;
    readonly entityId: Id;
    readonly expiresAt: Date;
  }): Promise<void>;
  /** Delete expired keys (T-PLAT-013). */
  pruneExpired(now: Date): Promise<number>;
};

/** Retention for an idempotency key: 24 h (docs/api/CONVENTIONS.md §5). */
export const IDEMPOTENCY_TTL_HOURS = 24;
