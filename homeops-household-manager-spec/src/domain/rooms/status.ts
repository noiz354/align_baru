// HomeOps - domain skeleton (specification phase). Pure rules only, no I/O.

import type { RoomEvidence, RoomStatusResult } from './types';

/**
 * Derive a room status from evidence - the ADR-010 rule set, first match wins:
 *   1. active override               -> the override status
 *   2. any occurrence IN_PROGRESS    -> CLEANING            (T-ROOM-005)
 *   3. any occurrence overdue        -> DIRTY               (T-ROOM-005)
 *   4. any occurrence due today      -> NEEDS_ATTENTION     (T-ROOM-005)
 *   5. completion within recency     -> CLEAN
 *   6. otherwise                     -> UNKNOWN
 *
 * Purity matters: no clock, no timezone, no database. The evidence carries the household
 * "today" and the completion instant, so identical inputs always yield an identical status
 * (I-ROOM-003). There is no numeric score anywhere in this function, by design (ADR-010).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ROOM-003 (rules 1, 5, 6) - requirements, ADR, design, and tests are listed there.
 */
export function deriveRoomStatus(_evidence: RoomEvidence): RoomStatusResult {
  throw new Error('Not implemented: T-ROOM-003');
}

/**
 * Set or replace a room status override (FR-ROOM-004).
 * Rules: at most one active override per room (I-ROOM-002); a newer override replaces the
 * previous one rather than stacking; expiry is bounded by the household maximum; attribution
 * is recorded and visible to every member (overrides are never anonymous).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ROOM-004 - requirements, ADR, design, and tests are listed there.
 */
export function applyRoomStatusOverride(_input: {
  readonly roomId: string;
  readonly existingOverride: RoomEvidence['activeOverride'];
  readonly status: RoomStatusResult['status'];
  readonly reason: string;
  readonly setByMemberId: string;
  readonly maxHours: number;
}): never {
  throw new Error('Not implemented: T-ROOM-004');
}

/**
 * Determine which overrides have expired as of `now` (swept by the scheduler job).
 * Expired overrides are already inert for derivation even before the sweep runs (I-ROOM-002),
 * which is why derivation checks expiry rather than trusting a stored flag.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ROOM-004 - requirements, ADR, design, and tests are listed there.
 */
export function findExpiredOverrides(_input: {
  readonly overrides: readonly { readonly id: string; readonly expiresAt: string }[];
  readonly now: string;
}): readonly string[] {
  throw new Error('Not implemented: T-ROOM-004');
}
