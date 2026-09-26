/**
 * Moderation case and ban types.
 *
 * Requirements:
 * - FR-MOD-001 … FR-MOD-008
 * - FR-SAFE-004, FR-SAFE-005, FR-SAFE-006
 *
 * ADR:
 * - ADR-010 (moderation model)
 * - ADR-012 (ban enforcement)
 *
 * See:
 * - MODERATION.md
 * - SAFETY.md §7, §8, §13
 * - DATA_MODEL.md §3.9, §3.10
 */

/** Moderation outcomes. A fixed enumeration — no free text (FR-MOD-004). */
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
  /** Required. An action without a reason code is rejected (FR-MOD-004). */
  reasonCode: string;
  /** The policy in force when the action was taken. */
  policyVersion: number;
  createdAt: Date;
}

/**
 * A ban record.
 *
 * DELIBERATELY ABSENT (ADR-012):
 * - raw IP address
 * - device fingerprint
 * - name, email, phone
 *
 * The ban subject is ALWAYS a pseudonymous session identity.
 */
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

/**
 * The six enforcement points. See SAFETY.md §13 and ADR-012.
 */
export const BAN_ENFORCEMENT_POINTS = [
  'queue-join',
  'candidate-selection',
  'session-creation',
  'report-submission',
  'websocket-connect',
  'turn-credential-mint',
] as const;

export type BanEnforcementPoint = (typeof BAN_ENFORCEMENT_POINTS)[number];

/**
 * The single permitted authority for ban checks.
 *
 * ADR-012 MR-1: every other module must call this port. A test asserts that
 * no other module queries the ban store directly.
 *
 * CRITICAL: ban checks FAIL CLOSED. If the ban store is unreachable, the
 * caller must not match. See RUNBOOK RB-04 and NFR-SAFE-004.
 *
 * T-BAN-051
 */
export interface BanEnforcementPort {
  isBanned(subjectId: string): Promise<boolean>;
  assertNotBanned(
    subjectId: string,
    point: BanEnforcementPoint,
  ): Promise<void>;
}

export const createNotImplementedBanEnforcementPort =
  (): BanEnforcementPort => ({
    async isBanned(_subjectId: string): Promise<boolean> {
      throw new Error('Not implemented: T-BAN-051');
    },
    async assertNotBanned(
      _subjectId: string,
      _point: BanEnforcementPoint,
    ): Promise<void> {
      throw new Error('Not implemented: T-BAN-051');
    },
  });

/**
 * The moderation port.
 *
 * T-MOD-041 / T-MOD-042
 *
 * Throws until implemented. No automated content classification is invoked
 * (FR-MOD-006). Moderators see session metadata only — never chat content or
 * media.
 */
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

export const createNotImplementedModerationPort = (): ModerationPort => ({
  async createCase(_reportId: string): Promise<ModerationCase> {
    throw new Error('Not implemented: T-MOD-041');
  },
  async applyAction(_input: {
    caseId: string;
    action: ModerationOutcome;
    actorId: string;
    targetType: ModerationAction['targetType'];
    targetId: string;
    reasonCode: string;
  }): Promise<ModerationAction> {
    throw new Error('Not implemented: T-MOD-042');
  },
});
