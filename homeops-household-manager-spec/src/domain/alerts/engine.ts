// HomeOps - domain skeleton (specification phase). Pure reconciliation only - no I/O.

import type { AlertEvaluationInput, AlertEvaluationResult } from './types';

/**
 * Reconcile desired alert state against existing alerts (FR-ALERT-005/009).
 * This function is pure and total: given the same household snapshot it returns the same plan, and
 * running it twice with unchanged state produces an empty plan (I-ALERT-003, I-ALERT-008).
 * It decides only what should exist; it never writes, never picks a channel, and never talks to
 * the scheduler. Producers (chores, trash, resources, maintenance, issues) are read as *state*,
 * not called - which is what keeps the module graph acyclic (docs/architecture/MODULE-MAP.md).

 * Output buckets: create (missing), refresh (content/priority changed), escalate (IMPORTANT/URGENT
 * past the delay, once per cooldown), resolve (condition vanished, with a reason), expire (INFO
 * alerts past their configured age).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-004 - requirements, ADR, design, and tests are listed there.
 */
export function evaluateAlerts(_input: AlertEvaluationInput): AlertEvaluationResult {
  throw new Error('Not implemented: T-ALERT-004');
}
