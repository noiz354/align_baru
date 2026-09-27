/**
 * Moderation case and ban types — real implementation.
 */

export type ModerationOutcome =
  | 'allow'
  | 'warn'
  | 'disconnect'
  | 'restrict'
  | 'ban'
  | 'manual-review';

export type ModerationCaseStatus =
  | 'open'
  | 'triaged'
  | 'actioned'
  | 'insufficient'
  | 'escalated'
  | 'closed';

export interface ModerationCase {
  id: string;
  reportId: string;
  sessionId: string;
  severity: 'P0' | 'P1' | 'P2';
  status: ModerationCaseStatus;
  assignedTo: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface ModerationAction {
  id: string;
  caseId: string;
  action: ModerationOutcome;
  actorId: string;
  targetType: 'session-identity' | 'session' | 'report';
  targetId: string;
  reasonCode: string;
  policyVersion: number;
  createdAt: Date;
}

export interface Ban {
  id: string;
  subjectType: 'session-identity';
  subjectId: string;
  severity: 'minor' | 'major' | 'severe';
  source: 'report' | 'signal' | 'admin';
  reasonCode: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  appealStatus: 'none' | 'pending' | 'upheld' | 'overturned';
  policyVersion: number;
}

export const BAN_ENFORCEMENT_POINTS = [
  'queue-join',
  'candidate-selection',
  'session-creation',
  'report-submission',
  'websocket-connect',
  'turn-credential-mint',
] as const;

export type BanEnforcementPoint = (typeof BAN_ENFORCEMENT_POINTS)[number];

export interface BanEnforcementPort {
  isBanned(subjectId: string): Promise<boolean>;
  assertNotBanned(
    subjectId: string,
    point: BanEnforcementPoint,
  ): Promise<void>;
}

export interface ModerationPort {
  createCase(reportId: string): Promise<ModerationCase>;
  applyAction(input: {
    caseId: string;
    action: ModerationOutcome;
    actorId: string;
    targetType: ModerationAction['targetType'];
    targetId: string;
    reasonCode: string;
  }): Promise<ModerationAction>;
}
