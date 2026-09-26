// HomeOps - domain skeleton (specification phase). Pure functions only.

import type { AlertType, Id } from '../../shared/types';

/**
 * Compute the dedupe key for a condition (FR-ALERT-005). Keys are stable across ticks and
 * contain opaque ids only - never a title, a member name, or any free text (no PII in keys).

 * Templates (docs/product/ALERTS.md):
 *   CHORE_DUE / CHORE_OVERDUE          chore:<occurrenceId>
 *   TRASH_FULL                         trash:<containerId>:full
 *   TRASH_COLLECTION_DUE               trash:<containerId>:due       (never merged across containers)
 *   RESOURCE_LOW                       resource:<householdId>:low     (grouped on purpose)
 *   RESOURCE_CRITICAL                  resource:<householdId>:critical
 *   MAINTENANCE_DUE / OVERDUE          maintenance:<planId>           (priority change, not a new alert)
 *   ISSUE_REQUIRES_ATTENTION           issue:<issueId>
 *   HOUSEHOLD_REMINDER                 reminder:<reminderId>

 * The consequence of this function is the product's single most important anti-fatigue guarantee:
 * the partial unique index on non-terminal alerts plus a stable key means repeated detection can
 * only ever refresh an existing alert, never create a second one (I-ALERT-001).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-003 - requirements, ADR, design, and tests are listed there.
 */
export function dedupeKeyFor(_input: {
  readonly type: AlertType;
  readonly householdId: Id;
  readonly entityId: Id;
}): string {
  throw new Error('Not implemented: T-ALERT-003');
}

/**
 * Assert key stability: the same condition evaluated at two different instants must
 * produce byte-identical keys, and grouped types must intentionally collide (that collision is the
 * grouping). Used by the dedupe test sweep (T-ALERT-033).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-003 - requirements, ADR, design, and tests are listed there.
 */
export function assertKeyStability(_keys: readonly string[]): void {
  throw new Error('Not implemented: T-ALERT-003');
}
