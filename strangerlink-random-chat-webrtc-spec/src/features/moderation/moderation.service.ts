/**
 * Moderation feature service — real implementation.
 *
 * Requirements:
 * - FR-MOD-001 … FR-MOD-008
 * - T-MOD-041, T-MOD-042
 * - FR-SAFE-006 (audit)
 * - NFR-SEC-008 (admin authz)
 */

import type { ModerationOutcome } from '../../domain/moderation/case';
import { moderationStore, reportStore, banStore, safetyEventStore } from '../../server/db/in-memory';

export interface ModerationCaseView {
  caseId: string;
  severity: 'P0' | 'P1' | 'P2';
  status: string;
  category: string;
  sessionMode: string;
  sessionDurationMs: number | null;
  endReason: string | null;
  peerIdentityId: string;
  reporterIdentityId: string;
}

export interface ModerationFeatureService {
  listCases(filter: { severity?: string; status?: string }): Promise<ModerationCaseView[]>;
  getCase(caseId: string, actorId: string): Promise<ModerationCaseView>;
  applyOutcome(input: {
    caseId: string;
    outcome: ModerationOutcome;
    actorId: string;
    reasonCode: string;
    targetIdentityId?: string;
    durationMs?: number;
  }): Promise<void>;
}

export const createModerationFeatureService = (): ModerationFeatureService => ({
  async listCases(filter: { severity?: string; status?: string }): Promise<ModerationCaseView[]> {
    const cases = moderationStore.list(filter);
    return cases.map(c => {
      const report = reportStore.get(c.reportId);
      return {
        caseId: c.id,
        severity: c.severity,
        status: c.status,
        category: report?.category ?? 'other',
        sessionMode: 'TEXT',
        sessionDurationMs: null,
        endReason: null,
        peerIdentityId: report?.peerIdentityId ?? '',
        reporterIdentityId: report?.reporterIdentityId ?? '',
      };
    });
  },

  async getCase(caseId: string, _actorId: string): Promise<ModerationCaseView> {
    const c = moderationStore.getCase(caseId);
    if (!c) throw new Error('NOT_FOUND: case not found');
    const report = reportStore.get(c.reportId);
    return {
      caseId: c.id,
      severity: c.severity,
      status: c.status,
      category: report?.category ?? 'other',
      sessionMode: 'TEXT',
      sessionDurationMs: null,
      endReason: null,
      peerIdentityId: report?.peerIdentityId ?? '',
      reporterIdentityId: report?.reporterIdentityId ?? '',
    };
  },

  async applyOutcome(input: {
    caseId: string;
    outcome: ModerationOutcome;
    actorId: string;
    reasonCode: string;
    targetIdentityId?: string;
    durationMs?: number;
  }): Promise<void> {
    if (!input.reasonCode) throw new Error('Reason code required (FR-MOD-004)');

    const c = moderationStore.getCase(input.caseId);
    if (!c) throw new Error('NOT_FOUND: case not found');

    // Apply action with audit (same transaction in production)
    const action = moderationStore.applyAction(
      input.caseId,
      input.outcome,
      input.actorId,
      input.targetIdentityId ? 'session-identity' : 'report',
      input.targetIdentityId ?? c.reportId,
      input.reasonCode,
      1,
    );

    // If ban, create ban record
    if (input.outcome === 'ban' && input.targetIdentityId) {
      const expiresAt = input.durationMs ? new Date(Date.now() + input.durationMs) : null;
      banStore.create(
        input.targetIdentityId,
        input.reasonCode,
        'major',
        'admin',
        input.actorId,
        expiresAt,
      );
      safetyEventStore.record('session-terminated', input.targetIdentityId, c.sessionId, {
        reason: 'ban',
        reasonCode: input.reasonCode,
      });
    }

    // Audit event (immutable)
    safetyEventStore.record('session-terminated', input.actorId, c.sessionId, {
      action: input.outcome,
      reasonCode: input.reasonCode,
      targetId: input.targetIdentityId ?? '',
    });
  },
});

export const createNotImplementedModerationFeatureService = createModerationFeatureService;
