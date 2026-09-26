/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/**
 * Idempotency infrastructure (ADR-0013, API.md §0). Replays return the ORIGINAL response marked as a
 * replay; a different payload under the same key is a hard error (`IDEMPOTENCY_MISMATCH`).
 */
export interface IdempotencyRecord {
  readonly key: string;
  readonly organizationId: string;
  readonly actorId: string;
  readonly requestHash: string;
  readonly responseBody: unknown;
  readonly statusCode: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

/** Throws. Task: T-FOUND-004. */
export async function beginIdempotentRequest(_input: {
  key: string;
  organizationId: string;
  actorId: string;
  requestHash: string;
}): Promise<{ kind: "NEW" } | { kind: "REPLAY"; record: IdempotencyRecord }> {
  throw new Error("Not implemented: T-FOUND-004");
}
