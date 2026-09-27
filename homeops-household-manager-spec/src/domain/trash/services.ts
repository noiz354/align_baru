// HomeOps - domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id } from '../../shared/types';
import type { TrashState, LocalDate } from '../../shared/types';
import type { TrashContainer, TrashStateEvent, CollectionDue } from './types';
import type { TrashRepository } from './ports';

export type TrashDeps = {
  readonly containers: TrashRepositoryPort;
  readonly clock: Clock;
};

/** Forward declaration keeps this file readable; the port is declared in ./ports.ts. */
export type TrashRepositoryPort = TrashRepository;

/**
 * Apply a state transition (FR-TRASH-002). Enforces the documented graph and the hysteresis
 * rule (I-TRASH-001, I-TRASH-003, I-TRASH-004):
 *   EMPTY -> AVAILABLE -> ALMOST_FULL -> FULL -> COLLECTION_REQUIRED
 * and always appends a state event (I-TRASH-002). Illegal moves return
 * TRASH_INVALID_TRANSITION; a transition to the current state is a no-op, not an error.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-TRASH-002 - requirements, ADR, design, and tests are listed there.
 */
export function transitionTrashState(_input: {
  readonly container: TrashContainer;
  readonly to: TrashState;
  readonly actorMemberId?: Id;
  readonly reason: 'MARKED_ALMOST_FULL' | 'MARKED_FULL' | 'RESET' | 'COLLECTION_MISSED';
  readonly note?: string;
  readonly nowInstant: string;
}): { readonly container: TrashContainer; readonly event: TrashStateEvent } {
  throw new Error('Not implemented: T-TRASH-002');
}

/**
 * Complete a collection (FR-TRASH-005). Idempotent per clientRequestId; allowed from FULL,
 * COLLECTION_REQUIRED, or ALMOST_FULL (with a note). Resets the state to EMPTY and closes the
 * container alerts with reason COLLECTED (I-TRASH-003). Tapping twice must never create a second
 * event.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-TRASH-008 - requirements, ADR, design, and tests are listed there.
 */
export async function completeTrashCollection(
  _deps: TrashDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly containerId: Id;
    readonly note?: string;
    readonly clientRequestId: string;
  },
): Promise<TrashContainer> {
  throw new Error('Not implemented: T-TRASH-008');
}

/**
 * Reset a container with a reason (FR-TRASH-003). A reset from FULL requires a reason
 * (I-TRASH-005, TRASH_RESET_REASON_REQUIRED); the reason is recorded in the state event so the
 * history stays honest ("emptied elsewhere" is a legitimate truth).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-TRASH-007 - requirements, ADR, design, and tests are listed there.
 */
export async function resetContainerState(
  _deps: TrashDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly containerId: Id;
    readonly reason: string;
  },
): Promise<TrashContainer> {
  throw new Error('Not implemented: T-TRASH-007');
}

/**
 * Evaluate which containers have a collection due (FR-TRASH-007). Pure condition: a reminder
 * exists only for a non-empty container whose collection window is opening; an EMPTY container
 * never produces a reminder (I-TRASH-006). The window is computed in the household timezone.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-TRASH-009 - requirements, ADR, design, and tests are listed there.
 */
export function evaluateCollectionDue(_input: {
  readonly containers: readonly TrashContainer[];
  readonly today: LocalDate;
  readonly householdTimezone: string;
}): readonly CollectionDue[] {
  throw new Error('Not implemented: T-TRASH-009');
}
