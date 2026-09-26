/**
 * API boundary contracts.
 *
 * See:
 * - API.md
 * - SECURITY.md
 *
 * CONTRACTS ONLY. No handlers, no validation wiring, no authorization.
 */

import type { ChatMode, ReportCategory } from './signaling';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface CreateIdentityRequest {
  consentVersion: number;
}

export interface CreateIdentityResponse {
  participantId: string;
  identityToken: string;
  expiresAt: string;
}

export interface VerifyIdentityResponse {
  participantId: string;
  status: 'ACTIVE' | 'RESTRICTED' | 'BANNED';
  /** Present when RESTRICTED or BANNED. */
  retryAfterMs?: number;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export interface JoinQueueRequest {
  mode: ChatMode;
  interestIds: string[];
  language: string | null;
  regionConstraint: string | null;
}

export interface QueueTicket {
  ticketId: string;
  joinedAt: string;
  expiresAt: string;
  mode: ChatMode;
}

export interface LeaveQueueRequest {
  ticketId: string;
}

export interface QueueStatusResponse {
  state: 'idle' | 'waiting' | 'matched';
  waitedMs?: number;
  sessionId?: string;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface SessionStateResponse {
  sessionId: string;
  status: string;
  mode: ChatMode;
  /** The caller's own role. No peer identifier is ever returned. */
  role: 'A' | 'B';
  createdAt: string;
  endedAt: string | null;
  endReason: string | null;
}

export interface EndSessionRequest {
  reason: 'skip' | 'leave';
}

export interface EndSessionResponse {
  ended: true;
  endReason: string;
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

export interface SubmitReportRequest {
  sessionId: string;
  category: ReportCategory;
  note?: string;
}

export interface SubmitReportResponse {
  reportId: string;
  received: true;
  /**
   * NEVER contains moderation reasoning, an outcome, or a timeline.
   * See FR-REPORT-009.
   */
}

export interface CreateBlockRequest {
  sessionId: string;
  scope: 'session' | 'platform';
}

export interface CreateBlockResponse {
  blockId: string;
  created: true;
}

// ---------------------------------------------------------------------------
// TURN credentials
// ---------------------------------------------------------------------------

export interface TurnCredentialsResponse {
  username: string;
  password: string;
  urls: string[];
  ttlSeconds: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Every API error uses a fixed allowlist code and a fixed message.
 * NEVER a stack trace, query, hostname, or IP address. See SECURITY.md §14.
 */
export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CONSENT_REQUIRED'
  | 'CONSENT_VERSION_MISMATCH'
  | 'MODE_DISABLED'
  | 'RESTRICTED'
  | 'ALREADY_IN_SESSION'
  | 'ALREADY_QUEUED'
  | 'ALREADY_ENDED'
  | 'SESSION_NOT_ACTIVE'
  | 'SESSION_SUPERSEDED'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'DUPLICATE'
  | 'INTERNAL';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

/**
 * The list of operations that must never be disabled by configuration.
 *
 * ADR-016 MR-5: `reports.enabled` does not exist as a configuration key, and a
 * test asserts the configuration schema rejects it.
 */
export const NON_DISABLEABLE_OPERATIONS = ['POST /api/report'] as const;
