/**
 * Chat service port.
 *
 * Requirements:
 * - FR-CHAT-001 … FR-CHAT-009
 *
 * ADR:
 * - ADR-004 (signaling model)
 * - ADR-013 (retention policy, Tier 0)
 *
 * See:
 * - CHAT.md
 * - STATE_MACHINE.md §7 (races C1–C6)
 *
 * SERVICE PORT ONLY. No chat logic exists in this phase.
 *
 * CRITICAL: messages are NEVER persisted. See ADR-013 Tier 0.
 */

import type { ChatMessage } from '../../domain/session/chat-message';
import type { MessageRejectionReason } from '../../shared/contracts/signaling';

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
  /**
   * Returns the messages held for `sessionId` in memory.
   *
   * In-memory only. There is no durable read path and there never will be.
   */
  getBufferedMessages(sessionId: string): ChatMessage[];
}

/**
 * T-CHAT-001 — Ephemeral text chat relay.
 *
 * Throws until implemented. When implemented it must:
 * - never write a message to durable storage
 * - assign a monotonic per-direction sequence
 * - enforce the length and rate limits server-side
 * - resolve races C1–C6 (CHAT.md §13)
 * - render links inert and accept no attachments
 */
export const createChatService = (): ChatService => ({
  async sendMessage(_input: SendMessageInput): Promise<SendMessageResult> {
    throw new Error('Not implemented: T-CHAT-001');
  },
  getBufferedMessages(_sessionId: string): ChatMessage[] {
    throw new Error('Not implemented: T-CHAT-001');
  },
});

/**
 * T-CHAT-002 — Six disconnect states in the UI.
 *
 * See DESIGN.md §12. The six states are never collapsed.
 */
export type SessionDisconnectState =
  | 'connection-failure'
  | 'peer-disconnected'
  | 'moderation-disconnect'
  | 'user-block'
  | 'session-timeout'
  | 'network-issue';

/**
 * Fixed, non-revealing copy per state.
 *
 * NFR-SAFE-002: moderation copy never discloses the rule, the signal, or the
 * actor.
 */
export const DISCONNECT_COPY: Readonly<
  Record<SessionDisconnectState, string>
> = {
  'connection-failure':
    "We couldn't reach the other person. You can try again or leave.",
  'peer-disconnected': 'Your stranger left the chat.',
  'moderation-disconnect':
    'This chat was ended by moderation. If you believe this is a mistake, you can report it.',
  'user-block': 'You blocked this person. They can’t match with you again.',
  'session-timeout': 'This chat ended because it ran too long.',
  'network-issue':
    'Your connection was lost. You can try again or leave.',
};
