// HomeOps - domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id, Instant } from '../../shared/types';
import type { ResolutionReason } from '../../shared/errors/codes';
import type { Alert, AlertEvaluationResult } from './types';
import type { AlertRepository } from './ports';

export type AlertDeps = {
  readonly alerts: AlertRepository;
  readonly clock: Clock;
};

/**
 * Apply an evaluation plan (the only writer of alert rows). Idempotent: re-running with the
 * same plan changes nothing, and a concurrent run loses the race on the partial unique index rather
 * than creating a duplicate - a unique violation is treated as "someone else refreshed it", not as
 * an error (I-ALERT-001). Every state change appends an alert_transition row in the same
 * transaction, and delivery intents are written to the outbox in that same transaction (ADR-009).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-004 - requirements, ADR, design, and tests are listed there.
 */
export async function applyAlertPlan(
  _deps: AlertDeps,
  _input: { readonly householdId: Id; readonly plan: AlertEvaluationResult },
): Promise<{
  readonly created: number;
  readonly refreshed: number;
  readonly resolved: number;
  readonly escalated: number;
}> {
  throw new Error('Not implemented: T-ALERT-004');
}

/**
 * Acknowledge an alert (FR-ALERT-007). Acknowledging is NOT resolving (I-ALERT-008): it stops
 * escalation, records the actor, and leaves the alert open and visible with "owned by X".
 * Terminal alerts return ALERT_TERMINAL; a repeat acknowledgement is a no-op, not an error.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-015 - requirements, ADR, design, and tests are listed there.
 */
export async function acknowledgeAlert(
  _deps: AlertDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly alertId: Id },
): Promise<Alert> {
  throw new Error('Not implemented: T-ALERT-015');
}

/**
 * Snooze an alert (FR-ALERT-008). Bounded by the household maximum (SNOOZE_TOO_LONG), attributed,
 * and automatically re-opened at `snoozedUntil` by the scheduler tick - not on read (I-ALERT-004).
 * Snoozing an unacknowledged alert does not mark it acknowledged: the household chose to defer, not
 * to accept ownership.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-016 - requirements, ADR, design, and tests are listed there.
 */
export async function snoozeAlert(
  _deps: AlertDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly alertId: Id;
    readonly snoozedUntil: Instant;
  },
): Promise<Alert> {
  throw new Error('Not implemented: T-ALERT-016');
}

/**
 * Resolve an alert manually (FR-ALERT-009) with a required reason. If the underlying condition
 * is still detected, the caller surfaces a warning ("we still detect this - it may come back")
 * because resolving does not silence reality; a re-detected condition opens a new alert under the
 * same dedupe key.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-017 - requirements, ADR, design, and tests are listed there.
 */
export async function resolveAlertManually(
  _deps: AlertDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly alertId: Id;
    readonly reason: ResolutionReason;
    readonly note?: string;
  },
): Promise<Alert> {
  throw new Error('Not implemented: T-ALERT-017');
}

/**
 * Reassign the recipient of an alert (FR-ALERT-010). The recipient must be an active
 * member of this household; the reason becomes MANUAL; future escalations target the new recipient;
 * historical transitions are untouched.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-018 - requirements, ADR, design, and tests are listed there.
 */
export async function reassignAlertRecipient(
  _deps: AlertDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly alertId: Id;
    readonly recipientMemberId: Id;
  },
): Promise<Alert> {
  throw new Error('Not implemented: T-ALERT-018');
}
