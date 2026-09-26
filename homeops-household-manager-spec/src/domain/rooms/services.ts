// HomeOps - domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id } from '../../shared/types';
import type { RoomRepository } from './ports';
import type { Room, RoomStatusResult } from './types';

export type RoomDeps = {
  readonly rooms: RoomRepository;
  readonly clock: Clock;
};

/**
 * Archive a room (FR-ROOM-005). Open occurrences must be reassigned, detached, or cancelled
 * first - the caller chooses explicitly so work is never silently deleted (I-ROOM-004).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ROOM-008 - requirements, ADR, design, and tests are listed there.
 */
export async function archiveRoom(
  _deps: RoomDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly roomId: Id;
    readonly openWorkHandling: 'REASSIGN' | 'DETACH' | 'CANCEL';
    readonly reassignToRoomId?: Id;
  },
): Promise<void> {
  throw new Error('Not implemented: T-ROOM-008');
}

/**
 * Toggle "not in use" (FR-ROOM-008). Excluded from derivation, dashboards, and alert
 * evaluation while set; toggling back restores the derived status immediately because no
 * data was destroyed.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ROOM-009 - requirements, ADR, design, and tests are listed there.
 */
export async function setRoomNotInUse(
  _deps: RoomDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly roomId: Id; readonly notInUse: boolean },
): Promise<Room> {
  throw new Error('Not implemented: T-ROOM-009');
}

/** Read-model helper for /rooms and the dashboard: derived statuses for a whole household, batched. */
export async function listRoomStatuses(
  _deps: RoomDeps,
  _input: { readonly householdId: Id },
): Promise<readonly { readonly room: Room; readonly status: RoomStatusResult }[]> {
  throw new Error('Not implemented: T-ROOM-006');
}
