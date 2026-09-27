// HomeOps - domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id } from '../../shared/types';
import type { ActivityEvent, ActivityType } from './types';
import type { ActivityRepository } from './ports';

export type ActivityDeps = {
  readonly activity: ActivityRepository;
  readonly clock: Clock;
};

/**
 * Append an activity entry (FR-ACT-001). Append-only, household-scoped, retention-stamped.
 * Rules: metadata carries ids, enums, and counts - never notes, comments, or titles beyond the
 * entity summary already visible in the app (I-ACT-003). Called from domain services inside the
 * same transaction as the change it describes, so history cannot drift from reality.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ACT-001 - requirements, ADR, design, and tests are listed there.
 */
export async function appendActivity(
  _deps: ActivityDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId?: Id;
    readonly type: ActivityType;
    readonly entity: { readonly kind: string; readonly id: Id };
    readonly summary: string;
    readonly metadata?: Readonly<Record<string, string | number>>;
  },
): Promise<ActivityEvent> {
  throw new Error('Not implemented: T-ACT-001');
}

/**
 * Prune activity beyond the household retention window (FR-ACT-005, I-ACT-004).
 * Batched, idempotent, and logged with counts only (no per-entry logging). Never touches open
 * alerts or open issues - history is prunable, live work is not.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-ACT-004 - requirements, ADR, design, and tests are listed there.
 */
export async function pruneActivity(
  _deps: ActivityDeps,
  _input: { readonly householdId: Id; readonly retentionMonths: number },
): Promise<{ readonly deleted: number }> {
  throw new Error('Not implemented: T-ACT-004');
}
