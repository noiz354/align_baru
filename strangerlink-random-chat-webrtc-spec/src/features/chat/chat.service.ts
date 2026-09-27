/**
 * Chat service — real implementation, ephemeral, never persisted.
 *
 * Requirements:
 * - FR-CHAT-001 … FR-CHAT-009
 * - T-CHAT-001, T-CHAT-002
 * - ADR-004, ADR-013 Tier 0
 */

import type { ChatMessage } from '../../domain/session/chat-message';
import { validateMessageBody, MAX_MESSAGES_PER_SESSION } from '../../domain/session/chat-message';
import type { MessageRejectionReason } from '../../shared/contracts/signaling';
import { sessionStore, messageBuffer, rateLimitStore, safetyEventStore } from '../../server/db/in-memory';

export interface SendMessageInput {
  sessionId: string;
  senderParticipantId: string;
  body: string;
}

export interface SendMessageResult {
  sequence: number;
  status: 'pending' | 'rejected';
  rejectionReason: MessageRejectionReason | null;
}

export interface ChatService {
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  getBufferedMessages(sessionId: string): ChatMessage[];
}

export const createChatService = (): ChatService => ({
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const session = sessionStore.get(input.sessionId);
    if (!session) {
      return { sequence: 0, status: 'rejected', rejectionReason: 'not-in-session' };
    }
    // Authorization: sender must be participant
    if (session.participantAId !== input.senderParticipantId && session.participantBId !== input.senderParticipantId) {
      return { sequence: 0, status: 'rejected', rejectionReason: 'not-in-session' };
    }
    // Session must be ACTIVE or CONNECTING (text-only may skip CONNECTING)
    if (!['MATCHED', 'CONNECTING', 'ACTIVE'].includes(session.status)) {
      return { sequence: 0, status: 'rejected', rejectionReason: 'not-in-session' };
    }

    // Rate limiting per identity per session (FR-CHAT-004, T-ABUSE-061)
    const rl = rateLimitStore.check(input.senderParticipantId, 'messagesPerSecond');
    if (!rl.allowed) {
      safetyEventStore.record('rate-limit-triggered', input.senderParticipantId, input.sessionId, {
        limit: 'messagesPerSecond',
        retryAfterMs: rl.retryAfterMs ?? 0,
      });
      return { sequence: 0, status: 'rejected', rejectionReason: 'rate-limited' };
    }

    // Per-session total cap (300)
    const count = rateLimitStore.incrementMessageCount(input.sessionId, input.senderParticipantId);
    if (count > MAX_MESSAGES_PER_SESSION) {
      return { sequence: 0, status: 'rejected', rejectionReason: 'rate-limited' };
    }

    // Validation: length, empty, spam
    const rejection = validateMessageBody(input.body);
    if (rejection) {
      return { sequence: 0, status: 'rejected', rejectionReason: rejection };
    }

    // Identical-content detection (ABUSE_PREVENTION §9.1)
    if (!rateLimitStore.checkIdentical(input.sessionId, input.senderParticipantId, input.body)) {
      return { sequence: 0, status: 'rejected', rejectionReason: 'spam' };
    }

    // Assign monotonic per-direction sequence
    const seq = messageBuffer.nextSeq(input.sessionId);

    const msg: ChatMessage = {
      sequence: seq,
      sessionId: input.sessionId,
      senderParticipantId: input.senderParticipantId,
      body: input.body,
      sentAt: new Date(),
      deliveredAt: null,
      status: 'delivered',
      rejectionReason: null,
    };

    // Ephemeral relay — in-memory only, never durable storage
    messageBuffer.add(input.sessionId, msg);

    // Message delivered — no persistence
    msg.deliveredAt = new Date();

    return { sequence: seq, status: 'pending', rejectionReason: null };
  },

  getBufferedMessages(sessionId: string): ChatMessage[] {
    return messageBuffer.get(sessionId);
  },
});

export type SessionDisconnectState =
  | 'connection-failure'
  | 'peer-disconnected'
  | 'moderation-disconnect'
  | 'user-block'
  | 'session-timeout'
  | 'network-issue';

export const DISCONNECT_COPY: Readonly<Record<SessionDisconnectState, string>> = {
  'connection-failure': "We couldn't reach the other person. You can try again or leave.",
  'peer-disconnected': 'Your stranger left the chat.',
  'moderation-disconnect': 'This chat was ended by moderation. If you believe this is a mistake, you can report it.',
  'user-block': 'You blocked this person. They can’t match with you again.',
  'session-timeout': 'This chat ended because it ran too long.',
  'network-issue': 'Your connection was lost. You can try again or leave.',
};
