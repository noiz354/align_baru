// HomeOps - domain skeleton (specification phase). Pure condition detection only.

import type { DetectedCondition, AlertEvaluationInput } from './types';

/**
 * Detect chore due/overdue conditions (FR-ALERT-002). A snoozed occurrence is silent until its
 * snooze expires; skipped, completed, and cancelled occurrences never produce a condition; paused
 * and archived definitions produce nothing at all. Overdue begins after the household grace window
 * and its priority rises with lateness (see defaultPriorityFor).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-005 - requirements, ADR, design, and tests are listed there.
 */
export function detectChoreConditions(_input: AlertEvaluationInput): readonly DetectedCondition[] {
  throw new Error('Not implemented: T-ALERT-005');
}

/**
 * Detect trash conditions (FR-ALERT-002/007): FULL, and a collection window opening while the
 * container is not empty. ALMOST_FULL produces nothing - a half-full bin is not a problem, and
 * treating it as one is exactly the fatigue this design avoids (I-TRASH-006). Two containers always
 * produce two independent alerts; they are never merged.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-006 - requirements, ADR, design, and tests are listed there.
 */
export function detectTrashConditions(_input: AlertEvaluationInput): readonly DetectedCondition[] {
  throw new Error('Not implemented: T-ALERT-006');
}

/**
 * Detect resource conditions (FR-ALERT-002, FR-RES-009). Grouped by design: one LOW alert and one
 * CRITICAL alert per household per window, each carrying its item list. CRITICAL/EMPTY items are
 * always named individually inside the grouped body and are never hidden inside "and 3 more"
 * (T-RES-018).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-007 - requirements, ADR, design, and tests are listed there.
 */
export function detectResourceConditions(_input: AlertEvaluationInput): readonly DetectedCondition[] {
  throw new Error('Not implemented: T-ALERT-007');
}

/**
 * Detect maintenance conditions (FR-ALERT-002): due when `today >= nextServiceAt - leadDays`, and
 * overdue from `nextServiceAt + 1 day` as a *priority change on the same alert*. Paused plans
 * produce nothing and their open alerts resolve with reason PAUSED (I-MNT-003).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-008 - requirements, ADR, design, and tests are listed there.
 */
export function detectMaintenanceConditions(_input: AlertEvaluationInput): readonly DetectedCondition[] {
  throw new Error('Not implemented: T-ALERT-008');
}

/**
 * Detect issue conditions (FR-ALERT-002, FR-ISSUE-007):
 *   SAFETY     URGENT immediately (quiet hours bypassed, always reaches an owner/admin)
 *   HIGH       IMPORTANT immediately
 *   NORMAL/LOW ATTENTION after the household delay window (default 24 h)
 * Acknowledgement stops escalation but keeps the alert open; resolution or close resolves it.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-009 - requirements, ADR, design, and tests are listed there.
 */
export function detectIssueConditions(_input: AlertEvaluationInput): readonly DetectedCondition[] {
  throw new Error('Not implemented: T-ALERT-009');
}
