/**
 * Repository ports.
 *
 * Requirements:
 * - NFR-SEC-001 (parameterised queries only)
 * - NFR-PRIV-004 (minimisation)
 * - NFR-PRIV-005 (retention enforced)
 *
 * ADR:
 * - ADR-002 (PostgreSQL)
 * - ADR-013 (retention policy)
 *
 * See:
 * - DATA_MODEL.md
 * - SECURITY.md §3
 * - RETENTION.md
 *
 * PORT ONLY. No driver is imported, no query is constructed, and no
 * database connection exists in this phase.
 *
 * ARCHITECTURAL RULE (ADR-002 MR-1):
 * All SQL lives behind these ports, inside `src/server/db/` and nowhere
 * else. A test asserts that no module outside this directory imports a
 * database driver.
 */

import type { Report, Ban, ModerationAction } from '../../domain/moderation/case';
import type { ChatSession, SessionStatus } from '../../domain/session/session';
import type { SafetyEvent } from '../../domain/safety/safety-event';

// ---------------------------------------------------------------------------
// ChatSession
// ---------------------------------------------------------------------------

export interface CreateSessionInput {
  participantAId: string;
  participantBId: string;
  mode: string;
  queueTicketId: string | null;
}

export interface ChatSessionRepository {
  create(input: CreateSessionInput): Promise<ChatSession>;
  findById(id: string): Promise<ChatSession | null>;
  updateStatus(
    id: string,
    status: SessionStatus,
    endReason: string | null,
  ): Promise<void>;
  findActiveForParticipant(participantId: string): Promise<ChatSession | null>;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ReportRepository {
  create(report: Omit<Report, 'id' | 'createdAt'>): Promise<Report>;
  findByDedupKey(dedupKey: string): Promise<Report | null>;
  findById(id: string): Promise<Report | null>;
  findByPeerIdentity(peerIdentityId: string): Promise<Report[]>;
}

// ---------------------------------------------------------------------------
// Ban
// ---------------------------------------------------------------------------

export interface BanRepository {
  create(ban: Omit<Ban, 'id' | 'createdAt'>): Promise<Ban>;
  findActiveForSubject(subjectId: string): Promise<Ban | null>;
  revoke(id: string, reasonCode: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// ModerationAction and AuditEvent
// ---------------------------------------------------------------------------

/**
 * AuditEvent is APPEND-ONLY.
 *
 * The application role has no UPDATE or DELETE grant on this table
 * (DATA_MODEL.md §5.3).
 */
export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reasonCode: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  policyVersion: number;
  createdAt: Date;
}

export interface ModerationActionRepository {
  create(action: Omit<ModerationAction, 'id' | 'createdAt'>): Promise<ModerationAction>;
  findByCaseId(caseId: string): Promise<ModerationAction[]>;
}

export interface AuditEventRepository {
  append(event: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent>;
  // NOTE: no update() and no delete() exist. By design.
}

// ---------------------------------------------------------------------------
// SafetyEvent
// ---------------------------------------------------------------------------

export interface SafetyEventRepository {
  append(event: Omit<SafetyEvent, 'id' | 'createdAt'>): Promise<SafetyEvent>;
  findOpenP0(): Promise<SafetyEvent[]>;
}

// ---------------------------------------------------------------------------
// Retention job
// ---------------------------------------------------------------------------

/**
 * The retention job.
 *
 * T-RET-131
 *
 * Throws until implemented. When implemented it must:
 * - be scheduled, idempotent, and logged
 * - ALERT ON FAILURE — a missed run is a privacy incident
 * - delete expired rows per tier (RETENTION.md §1)
 *
 * Scheduled for VS-15: a retention job before there is data is untestable.
 */
export interface RetentionJobPort {
  runOnce(): Promise<Record<string, number>>;
}

export const createNotImplementedRetentionJobPort = (): RetentionJobPort => ({
  async runOnce(): Promise<Record<string, number>> {
    throw new Error('Not implemented: T-RET-131');
  },
});

// ---------------------------------------------------------------------------
// Retention tiers (RETENTION.md §1)
// ---------------------------------------------------------------------------

/**
 * Tier 0 data is NEVER stored. A scheduled test asserts that no
 * message-content column exists in the schema (ADR-013 MR-3).
 */
export const RETENTION_TIERS = {
  chatContent: null, // not stored
  media: null, // not stored
  sessionMetadataDays: 30,
  reportMonths: 12,
  banAndAuditMonths: 24,
  telemetryMonths: 13,
  riskSignalHashDays: 7,
  coturnLogDays: 7,
} as const;

// ---------------------------------------------------------------------------
// Not-implemented factories
// ---------------------------------------------------------------------------

export const createNotImplementedChatSessionRepository =
  (): ChatSessionRepository => ({
    async create(_input: CreateSessionInput): Promise<ChatSession> {
      throw new Error('Not implemented: T-SESSION-004');
    },
    async findById(_id: string): Promise<ChatSession | null> {
      throw new Error('Not implemented: T-SESSION-004');
    },
    async updateStatus(
      _id: string,
      _status: SessionStatus,
      _endReason: string | null,
    ): Promise<void> {
      throw new Error('Not implemented: T-SESSION-004');
    },
    async findActiveForParticipant(
      _participantId: string,
    ): Promise<ChatSession | null> {
      throw new Error('Not implemented: T-SESSION-004');
    },
  });

export const createNotImplementedReportRepository = (): ReportRepository => ({
  async create(_report: Omit<Report, 'id' | 'createdAt'>): Promise<Report> {
    throw new Error('Not implemented: T-REPORT-006');
  },
  async findByDedupKey(_dedupKey: string): Promise<Report | null> {
    throw new Error('Not implemented: T-REPORT-006');
  },
  async findById(_id: string): Promise<Report | null> {
    throw new Error('Not implemented: T-REPORT-006');
  },
  async findByPeerIdentity(_peerIdentityId: string): Promise<Report[]> {
    throw new Error('Not implemented: T-REPORT-006');
  },
});

export const createNotImplementedBanRepository = (): BanRepository => ({
  async create(_ban: Omit<Ban, 'id' | 'createdAt'>): Promise<Ban> {
    throw new Error('Not implemented: T-BAN-051');
  },
  async findActiveForSubject(_subjectId: string): Promise<Ban | null> {
    throw new Error('Not implemented: T-BAN-051');
  },
  async revoke(_id: string, _reasonCode: string): Promise<void> {
    throw new Error('Not implemented: T-BAN-051');
  },
});
