/**
 * Domain event contracts.
 *
 * See:
 * - EVENTS.md
 * - DOMAIN.md §5
 *
 * CONTRACTS ONLY. No event bus, no dispatch, no persistence.
 *
 * CRITICAL RULE (EVENTS.md §2):
 * Payloads never contain message bodies, report notes, SDP, media, or
 * network addresses. An event never carries both participants' identifiers
 * except MatchCreated, which is used to construct the session and is then
 * discarded.
 */

import type { ChatMode, SessionEndReason } from './signaling';

export type DomainEventType =
  | 'ParticipantEnteredQueue'
  | 'ParticipantLeftQueue'
  | 'MatchCreated'
  | 'SessionStarted'
  | 'PeerConnected'
  | 'PeerDisconnected'
  | 'SessionEnded'
  | 'MessageSent'
  | 'ReportCreated'
  | 'BlockCreated'
  | 'ModerationActionApplied'
  | 'BanApplied'
  | 'SafetyEventRaised'
  | 'RateLimitTriggered'
  | 'ProtocolViolationDetected';

export interface DomainEvent<TType extends string, TPayload> {
  id: string;
  type: TType;
  /** ISO-8601 UTC. */
  occurredAt: string;
  sessionId: string | null;
  participantId: string | null;
  payload: TPayload;
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export interface ParticipantEnteredQueuePayload {
  mode: ChatMode;
  /** Count only. Interest VALUES are never included (EVENTS.md §2.1). */
  interestCount: number;
  hasLanguage: boolean;
  hasRegionConstraint: boolean;
}

export interface ParticipantLeftQueuePayload {
  reasonClass:
    | 'user-cancelled'
    | 'queue-expired'
    | 'cooldown'
    | 'restricted'
    | 'disconnected';
  waitedMs: number;
}

export interface MatchCreatedPayload {
  sessionId: string;
  mode: ChatMode;
  participantAId: string;
  participantBId: string;
  interestOverlap: number;
  matchedAt: string;
}

export interface SessionStartedPayload {
  sessionId: string;
  mode: ChatMode;
}

export interface PeerConnectedPayload {
  sessionId: string;
  mode: ChatMode;
  /** The only network-topology fact recorded. Not an address. */
  path: 'direct' | 'relay';
  setupMs: number;
}

export interface PeerDisconnectedPayload {
  sessionId: string;
  reasonClass: 'peer-left' | 'transport-lost' | 'skipped';
  recoverable: boolean;
}

export interface SessionEndedPayload {
  sessionId: string;
  endReason: SessionEndReason;
  durationMs: number;
}

export interface MessageSentPayload {
  sessionId: string;
  participantId: string;
  sequence: number;
  /** Coarse bucket. The body is NEVER present. */
  lengthBucket: '<100' | '100-500' | '500-2000';
}

export interface ReportCreatedPayload {
  reportId: string;
  sessionId: string;
  category: string;
  severity: 'P0' | 'P1' | 'P2';
  reporterIdentityId: string;
  peerIdentityId: string;
}

export interface BlockCreatedPayload {
  blockId: string;
  sessionId: string;
  scope: 'session' | 'platform';
  blockerIdentityId: string;
  blockedIdentityId: string;
}

export interface ModerationActionAppliedPayload {
  actionId: string;
  caseId: string;
  action: 'allow' | 'warn' | 'disconnect' | 'restrict' | 'ban' | 'manual-review';
  actorId: string;
  targetIdentityId: string | null;
  reasonCode: string;
  policyVersion: number;
}

export interface BanAppliedPayload {
  banId: string;
  subjectType: 'session-identity';
  subjectId: string;
  severity: 'minor' | 'major' | 'severe';
  source: 'report' | 'signal' | 'admin';
  expiresAt: string | null;
  policyVersion: number;
}

export type SafetyEventType =
  | 'age-attested'
  | 'consent-accepted'
  | 'minor-detected'
  | 'escalation-raised'
  | 'session-terminated'
  | 'rate-limit-triggered'
  | 'protocol-violation'
  | 'permission-denied';

export interface SafetyEventRaisedPayload {
  safetyEventId: string;
  type: SafetyEventType;
}

export interface RateLimitTriggeredPayload {
  limitName: string;
  scope: string;
  participantId: string;
  retryAfterMs: number;
}

export interface ProtocolViolationDetectedPayload {
  violationClass:
    | 'impersonation'
    | 'cross-session'
    | 'forbidden-field'
    | 'oversized-payload'
    | 'bad-origin';
  sessionId: string | null;
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export type DomainEventUnion =
  | DomainEvent<'ParticipantEnteredQueue', ParticipantEnteredQueuePayload>
  | DomainEvent<'ParticipantLeftQueue', ParticipantLeftQueuePayload>
  | DomainEvent<'MatchCreated', MatchCreatedPayload>
  | DomainEvent<'SessionStarted', SessionStartedPayload>
  | DomainEvent<'PeerConnected', PeerConnectedPayload>
  | DomainEvent<'PeerDisconnected', PeerDisconnectedPayload>
  | DomainEvent<'SessionEnded', SessionEndedPayload>
  | DomainEvent<'MessageSent', MessageSentPayload>
  | DomainEvent<'ReportCreated', ReportCreatedPayload>
  | DomainEvent<'BlockCreated', BlockCreatedPayload>
  | DomainEvent<'ModerationActionApplied', ModerationActionAppliedPayload>
  | DomainEvent<'BanApplied', BanAppliedPayload>
  | DomainEvent<'SafetyEventRaised', SafetyEventRaisedPayload>
  | DomainEvent<'RateLimitTriggered', RateLimitTriggeredPayload>
  | DomainEvent<'ProtocolViolationDetected', ProtocolViolationDetectedPayload>;

/**
 * In-process event dispatch placeholder.
 *
 * There is deliberately NO message broker. See EVENTS.md §6.
 */
export interface EventDispatcher {
  publish(event: DomainEventUnion): void;
}

export const createNoopEventDispatcher = (): EventDispatcher => ({
  publish(_event: DomainEventUnion): void {
    throw new Error('Not implemented: T-OBS-111');
  },
});
