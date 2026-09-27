'use server';

// HomeOps - feature skeleton (specification phase). Server Action shells only.
// Every action: validate shape -> authorize -> call a domain service -> map to OperationResult.
// No action contains business rules; those live in src/domain (docs/architecture/MODULE-MAP.md).

import type { OperationResult } from '../../shared/errors/result';

/**
 * Mark a container full (FR-TRASH-003). Creates or refreshes exactly one alert;
 * repeated taps are no-ops (I-TRASH-002).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-TRASH-004 - requirements, ADR, design, and tests are listed there.
 */
export async function markContainerFullAction(_input: {
  readonly containerId: string;
  readonly clientRequestId: string;
}): Promise<OperationResult<{ readonly containerId: string; readonly state: string }>> {
  throw new Error('Not implemented: T-TRASH-004');
}

/**
 * Complete a collection (FR-TRASH-005). Resets the state and closes the container
 * alerts with reason COLLECTED; idempotent per clientRequestId.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-TRASH-008 - requirements, ADR, design, and tests are listed there.
 */
export async function completeCollectionAction(_input: {
  readonly containerId: string;
  readonly note?: string;
  readonly clientRequestId: string;
}): Promise<OperationResult<{ readonly containerId: string; readonly state: string }>> {
  throw new Error('Not implemented: T-TRASH-008');
}
