// HomeOps - domain skeleton (specification phase). Ports only.
// Owning tasks: T-ACT-001..006.

import type { Id, Instant } from '../../shared/types';
import type { ActivityEvent } from './types';

/**
 * No update or delete method exists outside pruning: the absence is the invariant (I-ACT-001).
 */
export type ActivityRepository = {
  /** householdId first, always: the append-only log is the widest read surface in the app. */
  append(householdId: Id, event: ActivityEvent): Promise<void>;
  list(householdId: Id, options: {
    readonly limit: number;
    readonly cursor?: string;
    readonly types?: readonly string[];
    readonly actorMemberId?: Id;
    readonly since?: Instant;
    readonly until?: Instant;
  }): Promise<{ readonly events: readonly ActivityEvent[]; readonly nextCursor?: string }>;
  listForEntity(householdId: Id, entityKind: string, entityId: Id, limit: number): Promise<readonly ActivityEvent[]>;
  pruneBefore(householdId: Id, instant: Instant, batchSize: number): Promise<number>;
};

/** Operator-facing security/role audit trail - separate from household-visible activity (PRIVACY.md §4). */
export type AuditRepository = {
  append(householdId: Id, entry: {
    readonly householdId: Id;
    readonly actorUserId?: Id;
    readonly action: string;
    readonly targetKind?: string;
    readonly targetId?: string;
    readonly outcome: 'OK' | 'DENIED';
    readonly occurredAt: Instant;
  }): Promise<void>;
};
