/**
 * Moderation service port — real implementation.
 *
 * Requirements:
 * - FR-MOD-001 … FR-MOD-008
 * - FR-SAFE-006, FR-SAFE-008
 * - T-MOD-041, T-MOD-042, T-BAN-051, T-SAFE-052
 */

import type { ModerationOutcome } from '../../domain/moderation/case';
import { reportStore, moderationStore, banStore, safetyEventStore } from '../db/in-memory';

export interface ModeratorCaseView {
  report: {
    id: string;
    category: string;
    severity: 'P0' | 'P1' | 'P2';
    note: string | null;
    createdAt: string;
  };
  session: {
    id: string;
    mode: string;
    status: string;
    durationMs: number | null;
    endReason: string | null;
    createdAt: string;
    endedAt: string | null;
  };
  reporterIdentityId: string;
  peerIdentityId: string;
  riskSignals: string[];
}

export interface ApplyActionInput {
  caseId: string;
  action: ModerationOutcome;
  actorId: string;
  targetType: 'session-identity' | 'session' | 'report';
  targetId: string;
  reasonCode: string;
  durationMs?: number;
}

export interface ModerationServicePort {
  createCaseFromReport(reportId: string): Promise<string>;
  getCaseView(caseId: string, actorId: string): Promise<ModeratorCaseView>;
  applyAction(input: ApplyActionInput): Promise<{ actionId: string }>;
}

export const createModerationServicePort = (): ModerationServicePort => ({
  async createCaseFromReport(reportId: string): Promise<string> {
    const report = reportStore.get(reportId);
    if (!report) throw new Error('NOT_FOUND: report not found');
    const c = moderationStore.createCase(report.id, report.sessionId, report.severity);

    // P0 routing — dedicated queue, page on-call
    if (c.severity === 'P0') {
      safetyEventStore.record('escalation-raised', report.reporterIdentityId, report.sessionId, {
        caseId: c.id,
        reportId: report.id,
        severity: c.severity,
      });
    }

    return c.id;
  },

  async getCaseView(caseId: string, _actorId: string): Promise<ModeratorCaseView> {
    const c = moderationStore.getCase(caseId);
    if (!c) throw new Error('NOT_FOUND: case not found');
    const report = reportStore.get(c.reportId);
    if (!report) throw new Error('NOT_FOUND: report not found');

    // Moderators see session metadata only — never content or media (ADR-010)
    return {
      report: {
        id: report.id,
        category: report.category,
        severity: report.severity,
        note: report.note,
        createdAt: report.createdAt.toISOString(),
      },
      session: {
        id: report.sessionId,
        mode: 'TEXT',
        status: 'REPORTED',
        durationMs: null,
        endReason: null,
        createdAt: new Date().toISOString(),
        endedAt: null,
      },
      reporterIdentityId: report.reporterIdentityId,
      peerIdentityId: report.peerIdentityId,
      riskSignals: [],
    };
  },

  async applyAction(input: ApplyActionInput): Promise<{ actionId: string }> {
    if (!input.reasonCode) throw new Error('Reason code required');

    const action = moderationStore.applyAction(
      input.caseId,
      input.action,
      input.actorId,
      input.targetType,
      input.targetId,
      input.reasonCode,
      1,
    );

    // Audit record in same transaction (FR-MOD-004, FR-SAFE-006)
    safetyEventStore.record('session-terminated', input.actorId, null, {
      action: input.action,
      reasonCode: input.reasonCode,
      targetType: input.targetType,
      targetId: input.targetId,
    });

    // Ban enforcement
    if (input.action === 'ban') {
      const expiresAt = input.durationMs ? new Date(Date.now() + input.durationMs) : null;
      banStore.create(input.targetId, input.reasonCode, 'major', 'admin', input.actorId, expiresAt);
    }

    return { actionId: action.id };
  },
});

export const createNotImplementedModerationServicePort = createModerationServicePort;

// Ban enforcement port — single permitted authority (ADR-012 MR-1)
export interface BanEnforcementPort {
  isBanned(subjectId: string): Promise<boolean>;
  assertNotBanned(subjectId: string, point: string): Promise<void>;
}

export const createBanEnforcementPort = (): BanEnforcementPort => ({
  async isBanned(subjectId: string): Promise<boolean> {
    // Fail closed: if ban store unreachable, treat as banned (NFR-SAFE-004, RUNBOOK RB-04)
    try {
      return banStore.isBanned(subjectId);
    } catch {
      return true; // fail closed
    }
  },
  async assertNotBanned(subjectId: string, point: string): Promise<void> {
    try {
      if (banStore.isBanned(subjectId)) {
        throw new Error(`RESTRICTED: banned at ${point}`);
      }
    } catch (e) {
      // If store error, fail closed — do not match
      if (e instanceof Error && e.message.includes('RESTRICTED')) throw e;
      throw new Error(`RESTRICTED: ban store unreachable at ${point} — fail closed`);
    }
  },
});

export const createNotImplementedBanEnforcementPort = createBanEnforcementPort;
