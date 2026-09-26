'use server';

// HomeOps - feature skeleton (specification phase). Server Action shells only.
// Every action: validate shape -> authorize -> call a domain service -> map to OperationResult.
// No action contains business rules; those live in src/domain (docs/architecture/MODULE-MAP.md).

import type { OperationResult } from '../../shared/errors/result';
import type { RoomStatus } from '../../shared/types';

/**
 * Set a room status override (FR-ROOM-004). Any member; expiry bounded by the
 * household maximum; attribution recorded and shown to everyone.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ROOM-004 - requirements, ADR, design, and tests are listed there.
 */
export async function setRoomOverrideAction(
  _input: { readonly roomId: string; readonly status: RoomStatus; readonly reason: string; readonly hours: number },
): Promise<OperationResult<{ readonly overrideId: string }>> {
  throw new Error('Not implemented: T-ROOM-004');
}

/**
 * Update a room (name, group, order, not-in-use). Reordering uses explicit buttons, not
 * drag-only (INTERACTION-PATTERNS section 14).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ROOM-002 - requirements, ADR, design, and tests are listed there.
 */
export async function updateRoomAction(
  _input: { readonly roomId: string; readonly name?: string; readonly groupLabel?: string; readonly sortOrder?: number },
): Promise<OperationResult<{ readonly updated: true }>> {
  throw new Error('Not implemented: T-ROOM-002');
}
