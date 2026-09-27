'use server';

// HomeOps - feature skeleton (specification phase). Server Action shells only.
// Every action: validate shape -> authorize -> call a domain service -> map to OperationResult.
// No action contains business rules; those live in src/domain (docs/architecture/MODULE-MAP.md).

import type { OperationResult } from '../../shared/errors/result';

/**
 * Complete an occurrence (FR-CHORE-004). Idempotent: the client always sends a
 * clientRequestId; a replay returns the original result with meta.deduped = true.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-004 - requirements, ADR, design, and tests are listed there.
 */
export async function completeOccurrenceAction(_input: {
  readonly occurrenceId: string;
  readonly note?: string;
  readonly clientRequestId: string;
}): Promise<OperationResult<{ readonly occurrenceId: string; readonly completedAt: string }>> {
  throw new Error('Not implemented: T-CHORE-004');
}

/**
 * Skip an occurrence with a reason (FR-CHORE-007). One tap is enough; the reason keeps
 * the record honest and never advances a completion-anchored series (I-CHORE-005).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-007 - requirements, ADR, design, and tests are listed there.
 */
export async function skipOccurrenceAction(_input: {
  readonly occurrenceId: string;
  readonly reason: 'AWAY' | 'NOT_NEEDED' | 'CAME_UP' | 'OTHER';
  readonly note?: string;
}): Promise<OperationResult<{ readonly occurrenceId: string }>> {
  throw new Error('Not implemented: T-CHORE-007');
}

/**
 * Snooze an occurrence (FR-CHORE-009). The UI offers duration chips and shows the
 * resulting wall-clock time; a free-text date is never the interface (INTERACTION-PATTERNS section 4).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-008 - requirements, ADR, design, and tests are listed there.
 */
export async function snoozeOccurrenceAction(_input: {
  readonly occurrenceId: string;
  readonly snoozedUntil: string;
}): Promise<OperationResult<{ readonly occurrenceId: string; readonly snoozedUntil: string }>> {
  throw new Error('Not implemented: T-CHORE-008');
}
