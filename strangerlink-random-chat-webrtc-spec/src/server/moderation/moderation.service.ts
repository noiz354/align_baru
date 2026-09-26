/**
 * Moderation service port.
 *
 * Requirements:
 * - FR-MOD-001 … FR-MOD-008
 * - FR-SAFE-006 (audit every action)
 * - FR-SAFE-008 (escalation)
 *
 * ADR:
 * - ADR-010 (moderation model)
 * - ADR-012 (ban enforcement)
 *
 * See:
 * - MODERATION.md
 * - SAFETY.md §7, §8
 *
 * PORT ONLY. No moderation logic is implemented in this phase.
 *
 * THE MODERATOR VISIBILITY RULE (ADR-010):
 * Moderators see the report, the session metadata, and the risk signals.
 * They NEVER see chat content (it does not exist) or media (it is never
 * recorded).
 */

import type { ModerationOutcome } from '../../domain/moderation/case';

/** What a moderator is permitted to see. */
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
  /**
   * NEVER PRESENT: message content, media, transcript references, names,
   * emails, phone numbers, locations.
   */
}

/** Moderation action input. `reasonCode` is required (FR-MOD-004). */
export interface ApplyActionInput {
  caseId: string;
  action: ModerationOutcome;
  actorId: string;
  targetType: 'session-identity' | 'session' | 'report';
  targetId: string;
  reasonCode: string;
  /** Required for `restrict` and `ban`. */
  durationMs?: number;
}

/**
 * Moderation service port.
 *
 * T-MOD-041 (case creation and triage)
 * T-MOD-042 (action and audit)
 *
 * Throws until implemented. When implemented it must:
 * - create a case for every report, with category-driven severity
 * - route P0 to a dedicated always-monitored queue and page the on-call
 * - reject any action without a reason code
 * - write the audit event in the SAME transaction as the action
 * - never invoke automated content classification (FR-MOD-006)
 * - never disclose moderation reasoning to the affected user (NFR-SAFE-002)
 */
export interface ModerationServicePort {
  createCaseFromReport(reportId: string): Promise<string>;
  getCaseView(caseId: string, actorId: string): Promise<ModeratorCaseView>;
  applyAction(input: ApplyActionInput): Promise<{ actionId: string }>;
}

export const createNotImplementedModerationServicePort =
  (): ModerationServicePort => ({
    async createCaseFromReport(_reportId: string): Promise<string> {
      throw new Error('Not implemented: T-MOD-041');
    },
    async getCaseView(
      _caseId: string,
      _actorId: string,
    ): Promise<ModeratorCaseView> {
      throw new Error('Not implemented: T-MOD-041');
    },
    async applyAction(_input: ApplyActionInput): Promise<{ actionId: string }> {
      throw new Error('Not implemented: T-MOD-042');
    },
  });
