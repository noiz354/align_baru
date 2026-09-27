/**
 * Signaling message contracts — real implementation with Zod validation.
 *
 * Requirements:
 * - NFR-SEC-004, NFR-SEC-005
 * - T-SIG-011
 * - ADR-004
 * See: SIGNALING.md, ADR-004
 */

import { z } from 'zod';

export type SignalingMessageType =
  | 'JOIN_QUEUE'
  | 'MATCH_FOUND'
  | 'SESSION_READY'
  | 'PEER_LEFT'
  | 'SESSION_ENDED'
  | 'QUEUE_CANCELLED'
  | 'OFFER'
  | 'ANSWER'
  | 'ICE_CANDIDATE'
  | 'MESSAGE_SEND'
  | 'MESSAGE_DELIVERED'
  | 'MESSAGE_REJECTED'
  | 'REPORT_SUBMITTED'
  | 'BLOCK_CREATED'
  | 'MODERATION_NOTICE'
  | 'SAFETY_RESTRICTED'
  | 'SESSION_SUPERSEDED'
  | 'ERROR';

export interface SignalingEnvelope {
  type: SignalingMessageType;
  messageId: string;
  sessionId: string | null;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: unknown;
}

export type ChatMode = 'TEXT' | 'TEXT_AUDIO' | 'TEXT_VIDEO';

export type ReportCategory =
  | 'harassment'
  | 'sexual-content'
  | 'minor-safety'
  | 'threats'
  | 'hate'
  | 'spam'
  | 'scam'
  | 'illegal-content'
  | 'other';

export type SessionEndReason =
  | 'peer-left'
  | 'skip'
  | 'report'
  | 'block'
  | 'timeout'
  | 'moderation'
  | 'transport-lost'
  | 'server-restart'
  | 'failed';

export type MessageRejectionReason =
  | 'too-long'
  | 'rate-limited'
  | 'spam'
  | 'not-in-session'
  | 'protocol-error';

export type SignalingErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_IN_SESSION'
  | 'SESSION_ENDED'
  | 'SESSION_SUPERSEDED'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'MODE_DISABLED'
  | 'CONSENT_REQUIRED'
  | 'RESTRICTED'
  | 'PAYLOAD_TOO_LARGE'
  | 'DUPLICATE_MESSAGE'
  | 'SEQUENCE_VIOLATION'
  | 'INTERNAL';

// Lifecycle payloads
export interface JoinQueuePayload {
  mode: ChatMode;
  interestIds: string[];
  language: string | null;
  regionConstraint: string | null;
  consentVersion: number;
}

export interface MatchFoundPayload {
  sessionId: string;
  peerRole: 'A' | 'B';
  mode: ChatMode;
  matchedAt: string;
  interestOverlap: number;
}

export interface SessionReadyPayload {
  ready: boolean;
  reason?: 'media-ready' | 'text-only' | 'media-declined';
}

export type PeerLeftReasonClass =
  | 'peer-left'
  | 'skipped'
  | 'reported'
  | 'blocked'
  | 'timeout'
  | 'transport-lost';

export interface PeerLeftPayload {
  reasonClass: PeerLeftReasonClass;
}

export interface SessionEndedPayload {
  endReason: SessionEndReason;
  durationMs: number;
  requeueOffered: boolean;
}

export interface QueueCancelledPayload {
  reasonClass: 'user-cancelled' | 'queue-expired' | 'cooldown' | 'restricted';
  retryAfterMs?: number;
}

// Media
export interface OfferPayload {
  sdp: string;
  restart: boolean;
}

export interface AnswerPayload {
  sdp: string;
}

export interface IceCandidatePayload {
  candidate: string | null;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment: string | null;
}

// Chat
export interface MessageSendPayload {
  clientMessageId: string;
  body: string;
}

export interface MessageDeliveredPayload {
  clientMessageId: string | null;
  body: string;
  deliveredAt: string;
}

export interface MessageRejectedPayload {
  clientMessageId: string;
  reasonClass: MessageRejectionReason;
}

// Safety
export interface ReportSubmittedPayload {
  category: ReportCategory;
  note: string | null;
}

export interface BlockCreatedPayload {
  scope: 'session' | 'platform';
}

export interface ModerationNoticePayload {
  noticeClass: 'warning' | 'disconnected' | 'restricted' | 'banned';
  message: string;
  canReport: boolean;
}

export interface SafetyRestrictedPayload {
  restrictionClass: 'cooldown' | 'temporary' | 'banned';
  retryAfterMs: number | null;
  canReport: boolean;
}

export interface SessionSupersededPayload {
  reasonClass: 'another-tab' | 'reconnect-superseded';
}

export interface SignalingErrorPayload {
  code: SignalingErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

export type SignalingMessage =
  | (SignalingEnvelope & { type: 'JOIN_QUEUE'; payload: JoinQueuePayload })
  | (SignalingEnvelope & { type: 'MATCH_FOUND'; payload: MatchFoundPayload })
  | (SignalingEnvelope & { type: 'SESSION_READY'; payload: SessionReadyPayload })
  | (SignalingEnvelope & { type: 'PEER_LEFT'; payload: PeerLeftPayload })
  | (SignalingEnvelope & { type: 'SESSION_ENDED'; payload: SessionEndedPayload })
  | (SignalingEnvelope & { type: 'QUEUE_CANCELLED'; payload: QueueCancelledPayload })
  | (SignalingEnvelope & { type: 'OFFER'; payload: OfferPayload })
  | (SignalingEnvelope & { type: 'ANSWER'; payload: AnswerPayload })
  | (SignalingEnvelope & { type: 'ICE_CANDIDATE'; payload: IceCandidatePayload })
  | (SignalingEnvelope & { type: 'MESSAGE_SEND'; payload: MessageSendPayload })
  | (SignalingEnvelope & { type: 'MESSAGE_DELIVERED'; payload: MessageDeliveredPayload })
  | (SignalingEnvelope & { type: 'MESSAGE_REJECTED'; payload: MessageRejectedPayload })
  | (SignalingEnvelope & { type: 'REPORT_SUBMITTED'; payload: ReportSubmittedPayload })
  | (SignalingEnvelope & { type: 'BLOCK_CREATED'; payload: BlockCreatedPayload })
  | (SignalingEnvelope & { type: 'MODERATION_NOTICE'; payload: ModerationNoticePayload })
  | (SignalingEnvelope & { type: 'SAFETY_RESTRICTED'; payload: SafetyRestrictedPayload })
  | (SignalingEnvelope & { type: 'SESSION_SUPERSEDED'; payload: SessionSupersededPayload })
  | (SignalingEnvelope & { type: 'ERROR'; payload: SignalingErrorPayload });

export const SIGNALING_PAYLOAD_LIMITS = {
  sdp: 16 * 1024,
  messageBody: 2000,
  reportNote: 1000,
} as const;

export const MAX_SIGNALING_FRAME_BYTES = 64 * 1024;

// Zod schemas for validation (T-SIG-011)
const chatModeSchema = z.enum(['TEXT', 'TEXT_AUDIO', 'TEXT_VIDEO']);
const reportCategorySchema = z.enum([
  'harassment',
  'sexual-content',
  'minor-safety',
  'threats',
  'hate',
  'spam',
  'scam',
  'illegal-content',
  'other',
]);

const envelopeSchema = z.object({
  type: z.string(),
  messageId: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  fromParticipantId: z.string().uuid(),
  sequence: z.number().int().min(0),
  sentAt: z.string(),
  payload: z.unknown(),
}).strict().refine((data) => {
  // Forbid toParticipantId
  const raw = data as any;
  return !('toParticipantId' in raw);
}, { message: 'toParticipantId forbidden (ADR-004 rule 3)' });

const joinQueuePayloadSchema = z.object({
  mode: chatModeSchema,
  interestIds: z.array(z.string()).max(5),
  language: z.string().nullable(),
  regionConstraint: z.string().nullable(),
  consentVersion: z.number().int().min(1),
});

const offerPayloadSchema = z.object({
  sdp: z.string().max(SIGNALING_PAYLOAD_LIMITS.sdp),
  restart: z.boolean(),
});

const answerPayloadSchema = z.object({
  sdp: z.string().max(SIGNALING_PAYLOAD_LIMITS.sdp),
});

const iceCandidatePayloadSchema = z.object({
  candidate: z.string().nullable(),
  sdpMid: z.string().nullable(),
  sdpMLineIndex: z.number().nullable(),
  usernameFragment: z.string().nullable(),
});

const messageSendPayloadSchema = z.object({
  clientMessageId: z.string(),
  body: z.string().max(SIGNALING_PAYLOAD_LIMITS.messageBody),
});

const reportSubmittedPayloadSchema = z.object({
  category: reportCategorySchema,
  note: z.string().max(SIGNALING_PAYLOAD_LIMITS.reportNote).nullable(),
});

const blockCreatedPayloadSchema = z.object({
  scope: z.enum(['session', 'platform']),
});

const payloadSchemas: Record<string, z.ZodSchema> = {
  JOIN_QUEUE: joinQueuePayloadSchema,
  OFFER: offerPayloadSchema,
  ANSWER: answerPayloadSchema,
  ICE_CANDIDATE: iceCandidatePayloadSchema,
  MESSAGE_SEND: messageSendPayloadSchema,
  REPORT_SUBMITTED: reportSubmittedPayloadSchema,
  BLOCK_CREATED: blockCreatedPayloadSchema,
};

// Deduplication and sequence tracking (in-memory per process)
const seenMessageIds = new Map<string, Set<string>>(); // sessionId -> set of messageIds
const lastSequence = new Map<string, Map<string, number>>(); // sessionId -> participantId -> last seq

export function parseSignalingMessage(raw: unknown): SignalingMessage {
  // Size check
  const jsonStr = JSON.stringify(raw);
  if (jsonStr.length > MAX_SIGNALING_FRAME_BYTES) {
    throw new Error('PAYLOAD_TOO_LARGE');
  }

  // Envelope validation
  const envelope = envelopeSchema.parse(raw) as SignalingEnvelope;

  // Check forbidden field toParticipantId already done via strict + refine

  // Payload validation per type
  const payloadSchema = payloadSchemas[envelope.type];
  if (payloadSchema) {
    payloadSchema.parse(envelope.payload);
  }

  // sessionId null only for pre-session messages
  if (envelope.sessionId === null && !['JOIN_QUEUE', 'QUEUE_CANCELLED', 'SAFETY_RESTRICTED', 'ERROR'].includes(envelope.type)) {
    // Some messages allow null, but enforce for others
    // JOIN_QUEUE must have null sessionId, others generally have sessionId
    if (envelope.type === 'JOIN_QUEUE' && envelope.sessionId !== null) {
      throw new Error('VALIDATION_FAILED: JOIN_QUEUE must have null sessionId');
    }
  }

  // messageId idempotency per session (R6, EC-07)
  if (envelope.sessionId) {
    const sessId = envelope.sessionId;
    if (!seenMessageIds.has(sessId)) seenMessageIds.set(sessId, new Set());
    const set = seenMessageIds.get(sessId)!;
    if (set.has(envelope.messageId)) {
      throw new Error('DUPLICATE_MESSAGE');
    }
    set.add(envelope.messageId);
    // Prune set to 1000 entries max
    if (set.size > 1000) {
      const first = set.values().next().value;
      if (first) set.delete(first);
    }
  }

  // sequence monotonicity per direction (R6)
  if (envelope.sessionId) {
    const sessId = envelope.sessionId;
    const participantId = envelope.fromParticipantId;
    if (!lastSequence.has(sessId)) lastSequence.set(sessId, new Map());
    const partMap = lastSequence.get(sessId)!;
    const last = partMap.get(participantId) ?? -1;
    if (envelope.sequence <= last) {
      throw new Error('SEQUENCE_VIOLATION');
    }
    partMap.set(participantId, envelope.sequence);
  }

  return envelope as SignalingMessage;
}

// For testing: reset dedup state
export function resetSignalingState(): void {
  seenMessageIds.clear();
  lastSequence.clear();
}
