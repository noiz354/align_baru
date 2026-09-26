// HomeOps - domain skeleton (specification phase). Pure functions only.

import type { AlertPriority, AlertType } from '../../shared/types';

/**
 * Default priority per alert type, plus the reason recorded alongside it:
 *   CHORE_DUE ATTENTION            CHORE_OVERDUE IMPORTANT
 *   TRASH_FULL ATTENTION (IMPORTANT on collection day)   TRASH_COLLECTION_DUE IMPORTANT
 *   RESOURCE_LOW ATTENTION         RESOURCE_CRITICAL IMPORTANT
 *   MAINTENANCE_DUE ATTENTION      MAINTENANCE_OVERDUE IMPORTANT
 *   ISSUE_REQUIRES_ATTENTION ATTENTION -> URGENT for SAFETY severity
 *   HOUSEHOLD_REMINDER INFO

 * Priority drives escalation eligibility (IMPORTANT/URGENT only) and the nav badge count; it never
 * invents urgency for something the household considers routine (I-ALERT-005, ADR-008).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-002 - requirements, ADR, design, and tests are listed there.
 */
export function defaultPriorityFor(_input: {
  readonly type: AlertType;
  readonly todayIsCollectionDay?: boolean;
  readonly issueSeverity?: 'LOW' | 'NORMAL' | 'HIGH' | 'SAFETY';
  readonly daysOverdue?: number;
}): { readonly priority: AlertPriority; readonly reason: string } {
  throw new Error('Not implemented: T-ALERT-002');
}

/**
 * Decide whether a detected condition should raise the priority of an existing alert
 * (persistence-based escalation). Raising priority is a refresh on the same row - never a second
 * alert, and never more often than once per cooldown (I-ALERT-005).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ALERT-011 - requirements, ADR, design, and tests are listed there.
 */
export function shouldRaisePriority(_input: {
  readonly current: AlertPriority;
  readonly detected: AlertPriority;
  readonly lastEscalatedAtInstant: string | null;
  readonly cooldownHours: number;
  readonly nowInstant: string;
}): boolean {
  throw new Error('Not implemented: T-ALERT-011');
}
