/**
 * API boundary contracts — real implementation.
 */

import type { ChatMode, ReportCategory } from './signaling';

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
  retryAfterMs?: number;
}

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

export interface SessionStateResponse {
  sessionId: string;
  status: string;
  mode: ChatMode;
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

export interface SubmitReportRequest {
  sessionId: string;
  category: ReportCategory;
  note?: string;
}

export interface SubmitReportResponse {
  reportId: string;
  received: true;
}

export interface CreateBlockRequest {
  sessionId: string;
  scope: 'session' | 'platform';
}

export interface CreateBlockResponse {
  blockId: string;
  created: true;
}

export interface TurnCredentialsResponse {
  username: string;
  password: string;
  urls: string[];
  ttlSeconds: number;
}

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

export const NON_DISABLEABLE_OPERATIONS = ['POST /api/report'] as const;
