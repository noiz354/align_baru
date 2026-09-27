'use server';

// HomeOps - feature skeleton (specification phase). Server Action shells only.
// Every action: validate shape -> authorize -> call a domain service -> map to OperationResult.
// No action contains business rules; those live in src/domain (docs/architecture/MODULE-MAP.md).

import type { OperationResult } from '../../shared/errors/result';

export type CreateHouseholdInput = { readonly name: string; readonly timezone: string };

/**
 * Create the household for the signed-in user and make them its OWNER (FR-HH-001/002).
 * The household id is generated here and never accepted from the client (I-XA-002).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-HH-001 - requirements, ADR, design, and tests are listed there.
 */
export async function createHouseholdAction(
  _input: CreateHouseholdInput,
): Promise<OperationResult<{ readonly householdId: string }>> {
  throw new Error('Not implemented: T-HH-001');
}

/**
 * Update household name/timezone/settings (FR-HH-007). Timezone changes affect future
 * dates only; the UI must state that before saving (I-HH-004).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-HH-002 - requirements, ADR, design, and tests are listed there.
 */
export async function updateHouseholdSettingsAction(_input: {
  readonly name?: string;
  readonly timezone?: string;
  readonly settings?: Record<string, unknown>;
}): Promise<OperationResult<{ readonly updated: true }>> {
  throw new Error('Not implemented: T-HH-002');
}

/**
 * Request a household export (FR-SET-005). OWNER only, rate limited 2/day, audited.
 * Returns a job reference, not the archive itself: exports are produced out of band.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-HH-006 - requirements, ADR, design, and tests are listed there.
 */
export async function requestExportAction(): Promise<OperationResult<{ readonly exportRequestId: string }>> {
  throw new Error('Not implemented: T-HH-006');
}
