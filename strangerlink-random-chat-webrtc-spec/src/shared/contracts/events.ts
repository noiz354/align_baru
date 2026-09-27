/**
 * Domain event contracts — real implementation.
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
  occurredAt: string;
  sessionId: string | null;
  participantId: string | null;
  payload: TPayload;
}

export interface ParticipantEnteredQueuePayload {
  mode: ChatMode;
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

export interface EventDispatcher {
  publish(event: DomainEventUnion): void;
}

export const createEventDispatcher = (): EventDispatcher => {
  const events: DomainEventUnion[] = [];
  return {
    publish(event: DomainEventUnion): void {
      // No broker — in-process dispatch (EVENTS.md §6)
      // Validate no content leakage
      const payloadStr = JSON.stringify(event.payload);
      if (/body/i.test(payloadStr) && event.type === 'MessageSent') {
        // Only lengthBucket allowed, not body
        if (payloadStr.includes('"body"')) {
          throw new Error('Event payload must not contain message body (EVENTS.md §2)');
        }
      }
      events.push(event);
      // In production, would emit to OTel and metrics
    },
  };
};

export const createNoopEventDispatcher = createEventDispatcher;
