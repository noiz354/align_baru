/**
 * Ephemeral chat message types.
 *
 * Requirements:
 * - FR-CHAT-001 … FR-CHAT-009
 * - FR-CHAT-008 (no message persistence)
 *
 * ADR:
 * - ADR-004 (signaling model)
 * - ADR-013 (retention policy, Tier 0)
 *
 * See:
 * - CHAT.md
 * - RETENTION.md §2.1
 *
 * CRITICAL: messages are NEVER written to durable storage. They exist only
 * in memory for the duration of the session. A scheduled test asserts that
 * no table in the schema has a message-content column (ADR-013 MR-3).
 */

import type { MessageRejectionReason } from '../../shared/contracts/signaling';

/**
 * A message in flight. Held in memory only.
 */
export interface ChatMessage {
  /** Server-assigned, monotonic per session per direction. */
  sequence: number;
  sessionId: string;
  /** The sender's identity. The recipient is derived server-side. */
  senderParticipantId: string;
  body: string;
  sentAt: Date;
  deliveredAt: Date | null;
  status: MessageDeliveryStatus;
  rejectionReason: MessageRejectionReason | null;
}

/**
 * There are deliberately NO read receipts and NO typing indicators.
 * See CHAT.md §5.
 */
export type MessageDeliveryStatus = 'pending' | 'delivered' | 'rejected';

/** Maximum message length (FR-CHAT-003). */
export const MAX_MESSAGE_LENGTH = 2000;

/** Maximum messages per session (FR-CHAT-004). */
export const MAX_MESSAGES_PER_SESSION = 300;

/** Messages per 10-second window (FR-CHAT-004). */
export const MAX_MESSAGES_PER_10_SECONDS = 10;

/** Bounded reorder buffer. See CHAT.md §4. */
export const MESSAGE_REORDER_BUFFER = 16;

/**
 * Identical-content rejection threshold. See ABUSE_PREVENTION.md §9.1.
 */
export const IDENTICAL_MESSAGE_THRESHOLD = 3;

/**
 * Coarse length bucket for telemetry. The actual length and the body are
 * never recorded (EVENTS.md §2.8).
 */
export function toLengthBucket(body: string): '<100' | '100-500' | '500-2000' {
  if (body.length < 100) return '<100';
  if (body.length <= 500) return '100-500';
  return '500-2000';
}

/**
 * Validate a message body.
 *
 * Returns null when acceptable, otherwise the rejection reason class.
 */
export function validateMessageBody(body: string): MessageRejectionReason | null {
  if (body.length > MAX_MESSAGE_LENGTH) return 'too-long';
  if (body.length === 0) return 'protocol-error';
  return null;
}

/**
 * Message relay port.
 *
 * T-CHAT-001
 *
 * Throws until implemented. When implemented, this must NOT persist anything.
 */
export interface ChatRelayPort {
  relayMessage(message: ChatMessage): Promise<void>;
}

export const createNotImplementedChatRelay = (): ChatRelayPort => ({
  async relayMessage(_message: ChatMessage): Promise<void> {
    throw new Error('Not implemented: T-CHAT-001');
  },
});
