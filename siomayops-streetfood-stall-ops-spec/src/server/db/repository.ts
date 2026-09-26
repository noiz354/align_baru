/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

import type { Scope } from "../../shared/types/scope";

/** Every repository method takes an explicit scope (INV-11): unscoped access cannot be written. */
export interface ScopedRepository<TEntity, TCreate, TQuery> {
  findById(scope: Scope, id: string): Promise<TEntity | null>;
  list(scope: Scope, query: TQuery, page: { limit: number; cursor?: string }): Promise<{
    items: readonly TEntity[];
    nextCursor?: string;
  }>;
  create(scope: Scope, input: TCreate, context: WriteContext): Promise<TEntity>;
}

export interface WriteContext {
  readonly actorId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly clientRecordId?: string;
  readonly recordedAtDevice?: Date;
}

/** Throws. Task: T-FOUND-001. Transaction helper: business write + audit + outbox commit together. */
export async function withTransaction<T>(_fn: (tx: unknown) => Promise<T>): Promise<T> {
  throw new Error("Not implemented: T-FOUND-001");
}
