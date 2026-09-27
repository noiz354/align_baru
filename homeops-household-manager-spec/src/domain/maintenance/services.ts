// HomeOps - domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id, LocalDate } from '../../shared/types';
import type { MaintenancePlan, MaintenanceRecord } from './types';
import type { MaintenanceRepository } from './ports';

export type MaintenanceDeps = {
  readonly plans: MaintenanceRepository;
  readonly clock: Clock;
};

/**
 * Record a completed service (FR-MNT-005). At most three inputs: when, who (member or EXTERNAL),
 * and what happened. Backdating is allowed; the recomputed next date is returned so the UI can
 * confirm it ("Next service: 12 March 2027"). Resolves the plan due/overdue alert with reason
 * SERVICE_RECORDED and appends an activity entry - the record is the truth, the alert is derived
 * (I-MNT-001). Idempotent per clientRequestId.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MNT-005 - requirements, ADR, design, and tests are listed there.
 */
export async function recordService(
  _deps: MaintenanceDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly planId?: Id;
    readonly assetId?: Id;
    readonly performedOn: LocalDate;
    readonly performedByMemberId?: Id;
    readonly vendorNote?: string;
    readonly summary: string;
    readonly costNote?: string;
    readonly clientRequestId: string;
  },
): Promise<{ readonly record: MaintenanceRecord; readonly nextServiceAt: LocalDate }> {
  throw new Error('Not implemented: T-MNT-005');
}

/**
 * Pause or resume a plan (FR-MNT-009). Pausing closes the plan open alerts with reason PAUSED;
 * resuming recomputes the next date from the last record - never from the pause date, otherwise a
 * seasonal plan would come back "overdue" the moment it resumes (I-MNT-003).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MNT-009 - requirements, ADR, design, and tests are listed there.
 */
export async function setPlanLifecycle(
  _deps: MaintenanceDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly planId: Id;
    readonly action: 'PAUSE' | 'RESUME';
  },
): Promise<MaintenancePlan> {
  throw new Error('Not implemented: T-MNT-009');
}

/**
 * Link an issue to a plan or a record (FR-MNT-011). The link is a reference in both
 * directions; it never creates a record automatically and never rewrites history.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MNT-014 - requirements, ADR, design, and tests are listed there.
 */
export async function linkIssueToMaintenance(
  _deps: MaintenanceDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly issueId: Id;
    readonly planId?: Id;
    readonly recordId?: Id;
  },
): Promise<void> {
  throw new Error('Not implemented: T-MNT-014');
}
