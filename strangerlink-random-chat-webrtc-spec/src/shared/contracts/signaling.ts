/**
 * Signaling message contracts.
 *
 * Requirements:
 * - NFR-SEC-004 (schema validation of every inbound frame)
 * - NFR-SEC-005 (no cross-session message injection)
 *
 * ADR:
 * - ADR-004 (signaling model)
 *
 * See:
 * - SIGNALING.md
 * - docs/adr/ADR-004-signaling-model.md
 *
 * SCHEMA CONTRACTS ONLY.
 *
 * No WebSocket behaviour, transport, or dispatch logic exists in this phase.
 * The runtime Zod schemas are declared as `unknown` placeholders so that this
 * module remains a pure contract with no validation dependency.
 */

/** Signaling message types. See SIGNALING.md §3. */
export type SignalingMessageType =
  // Lifecycle
  | 'JOIN_QUEUE'
  | 'MATCH_FOUND'
  | 'SESSION_READY'
  | 'PEER_LEFT'
  | 'SESSION_ENDED'
  | 'QUEUE_CANCELLED'
  // Media negotiation
  | 'OFFER'
  | 'ANSWER'
  | 'ICE_CANDIDATE'
  // Chat
  | 'MESSAGE_SEND'
  | 'MESSAGE_DELIVERED'
  | 'MESSAGE_REJECTED'
  // Safety
  | 'REPORT_SUBMITTED'
  | 'BLOCK_CREATED'
  | 'MODERATION_NOTICE'
  | 'SAFETY_RESTRICTED'
  | 'SESSION_SUPERSEDED'
  // Error
  | 'ERROR';

/**
 * Envelope shared by every message in both directions.
 *
 * IMPORTANT: `toParticipantId` is deliberately absent from this type.
 * The recipient is derived server-side from `sessionId`. See ADR-004 rule 3.
 */
export interface SignalingEnvelope {
  type: SignalingMessageType;
  /** Idempotency key, unique per session. */
  messageId: string;
  /** Null only for pre-session messages (JOIN_QUEUE). */
  sessionId: string | null;
  /** MUST equal the authenticated socket identity. See ADR-004 rule 2. */
  fromParticipantId: string;
  /** Monotonic per session per direction. */
  sequence: number;
  /** ISO-8601 UTC. */
  sentAt: string;
  /** Shape determined by `type`. Opaque for SDP payloads. */
  payload: unknown;
}

/** Chat mode. Enforced at match time (FR-MEDIA-009). */
export type ChatMode = 'TEXT' | 'TEXT_AUDIO' | 'TEXT_VIDEO';

/** Report categories. See docs/safety/REPORTING.md §1. */
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

/** Session end reasons. Enum only — never free text. */
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

/** Message rejection reason classes. See CHAT.md §4. */
export type MessageRejectionReason =
  | 'too-long'
  | 'rate-limited'
  | 'spam'
  | 'not-in-session'
  | 'protocol-error';

/** Error codes returned on the signaling plane. See SIGNALING.md §5. */
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

// ---------------------------------------------------------------------------
// Lifecycle payloads
// ---------------------------------------------------------------------------

export interface JoinQueuePayload {
  mode: ChatMode;
  /** Max 5, all from the active vocabulary (ADR-009 IM-1). */
  interestIds: string[];
  /** BCP-47. */
  language: string | null;
  /** Coarse region code. Never a precise location. */
  regionConstraint: string | null;
  /** Must equal the server's current version, else re-consent. */
  consentVersion: number;
}

export interface MatchFoundPayload {
  sessionId: string;
  peerRole: 'A' | 'B';
  mode: ChatMode;
  matchedAt: string;
  /** Informational only. Peer interests are NOT disclosed (ADR-009 IM-3). */
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
  /**
   * NEVER 'banned-you' or any moderation detail.
   * See NFR-SAFE-002.
   */
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

// ---------------------------------------------------------------------------
// Media negotiation payloads
// ---------------------------------------------------------------------------

export interface OfferPayload {
  /** Opaque to the server. Max 16 KiB. See ADR-004 rule 6. */
  sdp: string;
  /** True when this is an ICE restart offer. */
  restart: boolean;
}

export interface AnswerPayload {
  sdp: string;
}

export interface IceCandidatePayload {
  /** Null marks end-of-candidates. */
  candidate: string | null;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment: string | null;
}

// ---------------------------------------------------------------------------
// Chat payloads
// ---------------------------------------------------------------------------

export interface MessageSendPayload {
  clientMessageId: string;
  /** Max 2000 characters (FR-CHAT-003). */
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

// ---------------------------------------------------------------------------
// Safety payloads
// ---------------------------------------------------------------------------

export interface ReportSubmittedPayload {
  category: ReportCategory;
  /** Max 1000 characters, sanitised. Optional. */
  note: string | null;
}

export interface BlockCreatedPayload {
  scope: 'session' | 'platform';
}

export interface ModerationNoticePayload {
  noticeClass: 'warning' | 'disconnected' | 'restricted' | 'banned';
  /**
   * Selected from a fixed allowlist of strings.
   * NEVER contains the triggering rule, the signal, or the actor.
   * See NFR-SAFE-002.
   */
  message: string;
  /** Always true — the user can always appeal. */
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
  /** From a fixed allowlist; never a stack trace, query, hostname, or IP. */
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

/**
 * The complete signaling message union.
 *
 * No WebSocket behaviour. See SIGNALING.md §4.
 */
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

/**
 * Size limits per message type.
 *
 * Requirements:
 * - FR-CHAT-003
 * - NFR-SEC-004
 */
export const SIGNALING_PAYLOAD_LIMITS = {
  sdp: 16 * 1024,
  messageBody: 2000,
  reportNote: 1000,
} as const;

/**
 * Socket-level frame cap. A hard second layer (ADR-003).
 */
export const MAX_SIGNALING_FRAME_BYTES = 64 * 1024;

/**
 * Runtime validation placeholder.
 *
 * T-SIG-011
 *
 * No Zod schema is instantiated in this phase. When implemented, this must
 * reject:
 * - a `toParticipantId` field (forbidden by ADR-004 rule 3)
 * - a `fromParticipantId` that does not match the authenticated identity
 * - an oversized payload
 * - a malformed envelope
 */
export function parseSignalingMessage(_raw: unknown): SignalingMessage {
  throw new Error('Not implemented: T-SIG-011');
}
