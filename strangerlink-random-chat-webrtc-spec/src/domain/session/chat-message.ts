/**
 * Ephemeral chat message types — real implementation.
 */

import type { MessageRejectionReason } from '../../shared/contracts/signaling';

export interface ChatMessage {
  sequence: number;
  sessionId: string;
  senderParticipantId: string;
  body: string;
  sentAt: Date;
  deliveredAt: Date | null;
  status: MessageDeliveryStatus;
  rejectionReason: MessageRejectionReason | null;
}

export type MessageDeliveryStatus = 'pending' | 'delivered' | 'rejected';

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_MESSAGES_PER_SESSION = 300;
export const MAX_MESSAGES_PER_10_SECONDS = 10;
export const MESSAGE_REORDER_BUFFER = 16;
export const IDENTICAL_MESSAGE_THRESHOLD = 3;

export function toLengthBucket(body: string): '<100' | '100-500' | '500-2000' {
  if (body.length < 100) return '<100';
  if (body.length <= 500) return '100-500';
  return '500-2000';
}

export function validateMessageBody(body: string): MessageRejectionReason | null {
  if (body.length > MAX_MESSAGE_LENGTH) return 'too-long';
  if (body.length === 0) return 'protocol-error';
  // Basic spam checks: too many URLs
  const urlCount = (body.match(/https?:\/\//g) || []).length;
  if (urlCount > 3) return 'spam';
  return null;
}

export interface ChatRelayPort {
  relayMessage(message: ChatMessage): Promise<void>;
}
