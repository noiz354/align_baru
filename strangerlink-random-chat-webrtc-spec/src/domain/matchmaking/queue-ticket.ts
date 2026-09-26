/**
 * Queue entry types.
 *
 * Requirements:
 * - FR-QUEUE-001 … FR-QUEUE-008
 *
 * ADR:
 * - ADR-008 (matchmaking model)
 * - ADR-009 (interest matching)
 *
 * See:
 * - MATCHMAKING.md
 * - DATA_MODEL.md §3.4
 *
 * Queue entries are EPHEMERAL. They are never persisted to PostgreSQL: a
 * durable queue table would be a durable record of who was looking for a
 * stranger (RETENTION.md Tier 1).
 */

import type { ChatMode } from '../../shared/contracts/signaling';

/** The queue key. Mode compatibility is enforced by the key (FR-MATCH-006). */
export interface QueueKey {
  mode: ChatMode;
}

/**
 * An in-memory queue entry.
 *
 * Discarded when the entry leaves the queue. Interests and language are
 * never stored beyond the entry's lifetime (ADR-009 IM-8).
 */
export interface QueueEntry {
  ticketId: string;
  participantId: string;
  mode: ChatMode;
  interestIds: string[];
  language: string | null;
  regionConstraint: string | null;
  joinedAt: Date;
  expiresAt: Date;
  status: QueueEntryStatus;
}

export type QueueEntryStatus = 'WAITING' | 'MATCHED' | 'CANCELLED' | 'EXPIRED';

/** Queue wait timeout. See PERFORMANCE.md §2. */
export const QUEUE_WAIT_TIMEOUT_MS = 120_000;

/** Interest preference window before falling back to the general pool. */
export const INTEREST_PREFERENCE_WINDOW_MS = 15_000;

/** Maximum interests a participant may select (ADR-009 IM-2). */
export const MAX_INTERESTS_PER_PARTICIPANT = 5;

/** Language preference window before falling back to the general pool. */
export const LANGUAGE_PREFERENCE_WINDOW_MS = 15_000;

/**
 * Join queue input.
 *
 * No personal data is accepted. Interests come from a closed vocabulary.
 */
export interface JoinQueueInput {
  participantId: string;
  mode: ChatMode;
  interestIds: string[];
  language: string | null;
  regionConstraint: string | null;
}

/**
 * The queue port.
 *
 * T-QUEUE-011
 *
 * Throws until implemented. When implemented, the queue must:
 * - be in-memory only
 * - issue at most one active ticket per participant
 * - be idempotent per participant + queue key
 * - release the claim immediately on cancellation, at any instant (R2, R9)
 * - offer retry or exit on expiry, never automatic requeue
 */
export interface QueuePort {
  joinQueue(input: JoinQueueInput): Promise<QueueEntry>;
  leaveQueue(participantId: string): Promise<void>;
  getEntry(participantId: string): QueueEntry | null;
  expireEntries(now: Date): QueueEntry[];
}

export const createNotImplementedQueuePort = (): QueuePort => ({
  async joinQueue(_input: JoinQueueInput): Promise<QueueEntry> {
    throw new Error('Not implemented: T-QUEUE-011');
  },
  async leaveQueue(_participantId: string): Promise<void> {
    throw new Error('Not implemented: T-QUEUE-011');
  },
  getEntry(_participantId: string): QueueEntry | null {
    throw new Error('Not implemented: T-QUEUE-011');
  },
  expireEntries(_now: Date): QueueEntry[] {
    throw new Error('Not implemented: T-QUEUE-011');
  },
});
