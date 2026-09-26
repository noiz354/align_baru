/**
 * Moderation feature service port.
 *
 * Requirements:
 * - FR-MOD-001 … FR-MOD-008
 *
 * ADR:
 * - ADR-010 (moderation model)
 *
 * See:
 * - MODERATION.md
 * - src/server/moderation/moderation.service.ts (the server-side port)
 *
 * SERVICE PORT ONLY. No moderation logic is implemented in this phase.
 */

import type { ModerationOutcome } from '../../domain/moderation/case';

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

/**
 * T-MOD-041 — Moderation case creation and triage.
 *
 * Throws until implemented. When implemented it must:
 * - create a case for every report, with category-driven severity
 * - route P0 to the dedicated always-monitored queue
 * - treat "insufficient information" as a legitimate, tracked outcome
 * - never expose chat content or media to a moderator (neither exists)
 */
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

export const createNotImplementedModerationFeatureService =
  (): ModerationFeatureService => ({
    async listCases(_filter: {
      severity?: string;
      status?: string;
    }): Promise<ModerationCaseView[]> {
      throw new Error('Not implemented: T-MOD-041');
    },
    async getCase(_caseId: string, _actorId: string): Promise<ModerationCaseView> {
      throw new Error('Not implemented: T-MOD-041');
    },
    async applyOutcome(_input: {
      caseId: string;
      outcome: ModerationOutcome;
      actorId: string;
      reasonCode: string;
      targetIdentityId?: string;
      durationMs?: number;
    }): Promise<void> {
      throw new Error('Not implemented: T-MOD-042');
    },
  });
