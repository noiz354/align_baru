/**
 * Queue service port.
 *
 * Requirements:
 * - FR-QUEUE-001 … FR-QUEUE-008
 *
 * ADR:
 * - ADR-008 (matchmaking model)
 *
 * See:
 * - MATCHMAKING.md §9, §10
 * - STATE_MACHINE.md §6 (R2, R9)
 *
 * SERVICE PORT ONLY. No queue logic exists in this phase.
 */

import type { QueueEntry } from '../../domain/matchmaking/queue-ticket';
import type { JoinQueueInput } from '../../domain/matchmaking/queue-ticket';

export interface QueueService {
  joinQueue(input: JoinQueueInput): Promise<QueueEntry>;
  leaveQueue(participantId: string): Promise<void>;
}

/**
 * T-QUEUE-011 — Join and cancel the queue.
 *
 * Throws until implemented. When implemented it must:
 * - issue at most one active ticket per participant
 * - be idempotent per participant + queue key
 * - release the claim immediately on cancellation, at any instant (R2, R9)
 * - bound the wait and offer retry or exit on expiry, never auto-requeue
 * - keep entries in memory only — never persist to PostgreSQL
 */
export const createQueueService = (): QueueService => ({
  async joinQueue(_input: JoinQueueInput): Promise<QueueEntry> {
    throw new Error('Not implemented: T-QUEUE-011');
  },
  async leaveQueue(_participantId: string): Promise<void> {
    throw new Error('Not implemented: T-QUEUE-011');
  },
});

/**
 * T-QUEUE-012 — Queue rate limiting and cooldown.
 *
 * Limits are per identity, not per connection (T-24).
 */
export interface QueueSafetyService {
  assertMayJoinQueue(participantId: string): Promise<void>;
  recordRapidJoinLeaveCycle(participantId: string): Promise<void>;
}

export const createQueueSafetyService = (): QueueSafetyService => ({
  async assertMayJoinQueue(_participantId: string): Promise<void> {
    throw new Error('Not implemented: T-QUEUE-012');
  },
  async recordRapidJoinLeaveCycle(_participantId: string): Promise<void> {
    throw new Error('Not implemented: T-QUEUE-012');
  },
});
