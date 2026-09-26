/**
 * Reports service port.
 *
 * Requirements:
 * - FR-REPORT-001 … FR-REPORT-010
 *
 * ADR:
 * - ADR-011 (reporting model)
 *
 * See:
 * - docs/safety/REPORTING.md
 * - SAFETY.md §5
 *
 * SERVICE PORT ONLY. Report submission is NOT functional in this phase.
 *
 * SAFETY-CRITICAL PROPERTIES:
 * - report submission must remain possible even if the peer disconnects
 *   immediately (FR-REPORT-002, INV-8)
 * - a banned or restricted user can still report
 * - there is no configuration key that can disable reporting (ADR-016 MR-5)
 */

import type { ReportCategory } from '../../shared/contracts/signaling';

export interface SubmitReportInput {
  sessionId: string;
  category: ReportCategory;
  note: string | null;
}

export interface ReportAcknowledgement {
  reportId: string;
  received: true;
  /**
   * NEVER contains moderation reasoning, an outcome, or a timeline.
   * See FR-REPORT-009 and NFR-SAFE-002.
   */
}

export interface ReportsService {
  submitReport(
    reporterIdentityId: string,
    input: SubmitReportInput,
  ): Promise<ReportAcknowledgement>;
}

/**
 * T-REPORT-006 — Submit a safety report.
 *
 * Throws until implemented. When implemented it must:
 * - accept a report against a session in ANY status, including terminal
 * - collect no name, email, phone, or account
 * - collapse duplicates on (session, category)
 * - rate limit to 5 per hour per identity
 * - end the session on submission
 * - route P0 categories to the dedicated always-monitored queue
 * - return an acknowledgement without moderation reasoning
 */
export const createReportsService = (): ReportsService => ({
  async submitReport(
    _reporterIdentityId: string,
    _input: SubmitReportInput,
  ): Promise<ReportAcknowledgement> {
    throw new Error('Not implemented: T-REPORT-006');
  },
});

/**
 * T-REPORT-016 — Report credibility weighting.
 *
 * Detects and down-weights report flooding and retaliation. Reports are
 * NEVER auto-actioned into a ban.
 */
export interface ReportCredibilityService {
  /** A credibility weight in [0, 1]. */
  weightFor(identityId: string): Promise<number>;
}

export const createReportCredibilityService = (): ReportCredibilityService => ({
  async weightFor(_identityId: string): Promise<number> {
    throw new Error('Not implemented: T-REPORT-016');
  },
});
