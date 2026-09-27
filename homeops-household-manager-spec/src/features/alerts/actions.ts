'use server';

// HomeOps - feature skeleton (specification phase). Server Action shells only.
// Every action: validate shape -> authorize -> call a domain service -> map to OperationResult.
// No action contains business rules; those live in src/domain (docs/architecture/MODULE-MAP.md).

import type { OperationResult } from '../../shared/errors/result';
import type { ResolutionReason } from '../../shared/errors/codes';

/**
 * Acknowledge an alert (FR-ALERT-007). Stops escalation, keeps the alert open, records
 * who owns it. Never a broadcast, never a resolve (I-ALERT-008).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-015 - requirements, ADR, design, and tests are listed there.
 */
export async function acknowledgeAlertAction(_input: {
  readonly alertId: string;
}): Promise<OperationResult<{ readonly alertId: string; readonly state: string }>> {
  throw new Error('Not implemented: T-ALERT-015');
}

/**
 * Snooze an alert (FR-ALERT-008). Duration chips only, bounded by the household
 * maximum; re-opens automatically at expiry (I-ALERT-004).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-016 - requirements, ADR, design, and tests are listed there.
 */
export async function snoozeAlertAction(_input: {
  readonly alertId: string;
  readonly snoozedUntil: string;
}): Promise<OperationResult<{ readonly alertId: string; readonly snoozedUntil: string }>> {
  throw new Error('Not implemented: T-ALERT-016');
}

/**
 * Resolve an alert manually (FR-ALERT-009) with a required reason; the UI warns when
 * the condition is still detected, because resolving does not silence reality.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-017 - requirements, ADR, design, and tests are listed there.
 */
export async function resolveAlertAction(_input: {
  readonly alertId: string;
  readonly reason: ResolutionReason;
  readonly note?: string;
}): Promise<OperationResult<{ readonly alertId: string }>> {
  throw new Error('Not implemented: T-ALERT-017');
}
