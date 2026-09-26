'use server';

// HomeOps - feature skeleton (specification phase). Server Action shells only.
// Every action: validate shape -> authorize -> call a domain service -> map to OperationResult.
// No action contains business rules; those live in src/domain (docs/architecture/MODULE-MAP.md).

import type { OperationResult } from '../../shared/errors/result';

/**
 * Record a service (FR-MNT-005). Three inputs maximum; backdating allowed; returns the
 * recomputed next date so the UI can confirm it immediately.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MNT-005 - requirements, ADR, design, and tests are listed there.
 */
export async function recordServiceAction(
  _input: {
    readonly planId: string;
    readonly performedOn: string;
    readonly performedByMemberId?: string;
    readonly vendorNote?: string;
    readonly summary: string;
    readonly costNote?: string;
    readonly clientRequestId: string;
  },
): Promise<OperationResult<{ readonly recordId: string; readonly nextServiceAt: string }>> {
  throw new Error('Not implemented: T-MNT-005');
}

/**
 * Pause or resume a plan (FR-MNT-009). Resuming recomputes from the last record, never
 * from the pause date (I-MNT-003).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MNT-009 - requirements, ADR, design, and tests are listed there.
 */
export async function setPlanLifecycleAction(
  _input: { readonly planId: string; readonly action: 'PAUSE' | 'RESUME' },
): Promise<OperationResult<{ readonly paused: boolean }>> {
  throw new Error('Not implemented: T-MNT-009');
}
