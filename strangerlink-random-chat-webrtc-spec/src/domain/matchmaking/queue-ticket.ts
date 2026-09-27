/**
 * Queue entry types — real implementation.
 */

import type { ChatMode } from '../../shared/contracts/signaling';

export interface QueueKey {
  mode: ChatMode;
}

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

export const QUEUE_WAIT_TIMEOUT_MS = 120_000;
export const INTEREST_PREFERENCE_WINDOW_MS = 15_000;
export const MAX_INTERESTS_PER_PARTICIPANT = 5;
export const LANGUAGE_PREFERENCE_WINDOW_MS = 15_000;

export interface JoinQueueInput {
  participantId: string;
  mode: ChatMode;
  interestIds: string[];
  language: string | null;
  regionConstraint: string | null;
}

export interface QueuePort {
  joinQueue(input: JoinQueueInput): Promise<QueueEntry>;
  leaveQueue(participantId: string): Promise<void>;
  getEntry(participantId: string): QueueEntry | null;
  expireEntries(now: Date): QueueEntry[];
}
