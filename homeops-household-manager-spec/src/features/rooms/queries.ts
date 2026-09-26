// HomeOps - feature skeleton (specification phase). Read-model loaders only.

import type { RoomStatus } from '../../shared/types';

/** A room row as the list and dashboard render it: status plus the evidence, never a score. */
export type RoomListRowDto = {
  readonly id: string;
  readonly name: string;
  readonly status: RoomStatus;
  /** One plain sentence, e.g. 'Deep clean is 2 days overdue'. */
  readonly reason: string;
  /** Set when the status came from a manual override, so nobody is confused by a running chore. */
  readonly overriddenBy?: { readonly displayName: string; readonly expiresAt: string };
  readonly openWorkCount: number;
};

/**
 * Load room rows for a household (batched evidence load, no query per room -
 * PERFORMANCE.md PB-S3). Excludes archived rooms and, by default, rooms marked not-in-use.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ROOM-006 - requirements, ADR, design, and tests are listed there.
 */
export async function loadRoomListRows(): Promise<readonly RoomListRowDto[]> {
  throw new Error('Not implemented: T-ROOM-006');
}
