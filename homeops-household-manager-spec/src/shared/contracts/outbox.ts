// HomeOps — transactional outbox contract (T-PLAT-012, ADR-009, ADR-013).
//
// Notification delivery never happens inside the domain transaction. The write enqueues an outbox
// row in the *same* transaction as the state change; the drain job delivers later, best-effort, and
// records the attempt (ARCHITECTURE.md §7 step 7, I-XA-007).

import type { Id } from '../types';

export type OutboxTopic =
  | 'alert.created'
  | 'alert.updated'
  | 'alert.resolved'
  | 'invitation.created'
  | 'password.reset-requested'
  | 'member.removed';

export type OutboxMessageValue = {
  readonly id: Id;
  readonly householdId: Id | null;
  readonly dedupeKey: string;
  readonly topic: OutboxTopic;
  /** Ids, enums, and counts only — never titles, notes, or free text (PRIVACY.md §5). */
  readonly payload: Readonly<Record<string, string | number>>;
  readonly state: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'DEAD';
  readonly attempts: number;
  readonly nextAttemptAt: string;
};

export type OutboxStore = {
  /** Enqueue inside the caller's transaction; a duplicate dedupe key is a no-op, not an error. */
  enqueue(
    message: Omit<OutboxMessageValue, 'id' | 'state' | 'attempts' | 'nextAttemptAt'> & {
      readonly id: Id;
      readonly nextAttemptAt: Date;
    },
  ): Promise<void>;
  /** Claim due rows for delivery (`FOR UPDATE SKIP LOCKED`, FINAL-REVIEW.md §4). */
  claimDue(input: { readonly now: Date; readonly limit: number }): Promise<readonly OutboxMessageValue[]>;
  markProcessed(id: Id, now: Date): Promise<void>;
  markFailed(input: {
    readonly id: Id;
    readonly now: Date;
    readonly errorClass: string;
    readonly retryInMs: number;
  }): Promise<void>;
  markDead(input: { readonly id: Id; readonly now: Date; readonly errorClass: string }): Promise<void>;
  counts(): Promise<{ readonly pending: number; readonly dead: number }>;
  pruneProcessed(olderThan: Date): Promise<number>;
};

/** Delivery attempts before a message becomes a dead letter (RUNBOOK.md#push-failures). */
export const OUTBOX_MAX_ATTEMPTS = 8;
