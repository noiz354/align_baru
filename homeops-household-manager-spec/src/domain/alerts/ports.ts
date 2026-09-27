// HomeOps - domain skeleton (specification phase). Ports only.
// Owning tasks: T-ALERT-001..035.

import type { AlertState, Id } from '../../shared/types';
import type { Alert, AlertTransition } from './types';

export type AlertRepository = {
  findById(householdId: Id, alertId: Id): Promise<Alert | null>;
  /** Non-terminal rows only; the partial unique index on dedupeKey lives here (I-ALERT-001). */
  findByDedupeKey(householdId: Id, dedupeKey: string): Promise<Alert | null>;
  listOpen(householdId: Id): Promise<readonly Alert[]>;
  listByHousehold(
    householdId: Id,
    options: {
      readonly states?: readonly AlertState[];
      readonly types?: readonly string[];
      readonly recipientMemberId?: Id;
      readonly limit: number;
      readonly cursor?: string;
    },
  ): Promise<{ readonly alerts: readonly Alert[]; readonly nextCursor?: string }>;
  countOpenAttention(householdId: Id): Promise<number>;
  insert(alert: Alert): Promise<void>;
  update(alert: Alert): Promise<void>;
  /** Append-only transition log; every state change writes exactly one row per transition (I-ALERT-006). */
  /** householdId first: a transition row has no scope of its own (I-XA-001a). */
  appendTransition(householdId: Id, transition: AlertTransition): Promise<void>;
  listTransitions(householdId: Id, alertId: Id): Promise<readonly AlertTransition[]>;
  /** Snooze expiry sweep input (I-ALERT-004): alerts whose snooze has elapsed. */
  listSnoozedExpired(householdId: Id, now: Date): Promise<readonly Alert[]>;
};
