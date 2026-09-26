/**
 * Report domain types.
 *
 * Requirements:
 * - FR-REPORT-001 … FR-REPORT-010
 *
 * ADR:
 * - ADR-011 (reporting model)
 *
 * See:
 * - docs/safety/REPORTING.md
 * - DATA_MODEL.md §3.7
 */

import type { ReportCategory } from '../../shared/contracts/signaling';

/** Report severity, derived from the category. */
export type ReportSeverity = 'P0' | 'P1' | 'P2';

export type ReportStatus = 'open' | 'triaged' | 'actioned' | 'insufficient' | 'escalated' | 'closed';

/**
 * A safety report.
 *
 * DELIBERATELY ABSENT (docs/safety/REPORTING.md §2):
 * - name, email, phone number
 * - location
 * - device fingerprint
 * - account identifier
 * - chat transcript reference
 * - media reference
 */
export interface Report {
  id: string;
  /** May be a terminal session (INV-8, ADR-011 MR-1). */
  sessionId: string;
  reporterIdentityId: string;
  peerIdentityId: string;
  category: ReportCategory;
  severity: ReportSeverity;
  /** Max 1000 characters, sanitised. Optional. */
  note: string | null;
  /** (sessionId, category) — unique. See FR-REPORT-006. */
  dedupKey: string;
  status: ReportStatus;
  createdAt: Date;
}

/** Maximum report note length. */
export const MAX_REPORT_NOTE_LENGTH = 1000;

/** Report rate limit (FR-REPORT-007). */
export const REPORTS_PER_HOUR = 5;

/**
 * P0 categories bypass the normal triage queue entirely and page the
 * on-call. See SAFETY.md §8.1 and FR-SAFE-008.
 */
export const P0_CATEGORIES: readonly ReportCategory[] = [
  'minor-safety',
  'illegal-content',
  'threats',
];

export function severityForCategory(category: ReportCategory): ReportSeverity {
  if (P0_CATEGORIES.includes(category)) return 'P0';
  if (
    category === 'harassment' ||
    category === 'sexual-content' ||
    category === 'scam' ||
    category === 'hate'
  ) {
    return 'P1';
  }
  return 'P2';
}

/**
 * The dedup key. A duplicate returns the existing report id rather than
 * creating a second one (FR-REPORT-006).
 */
export function reportDedupKey(sessionId: string, category: ReportCategory): string {
  return `${sessionId}:${category}`;
}

/**
 * Submit a safety report.
 *
 * T-REPORT-006
 *
 * Safety: report submission must remain possible even if the peer
 * disconnects immediately. A banned or restricted identity may still report.
 *
 * Throws until implemented. Nothing about moderation outcomes, reasoning, or
 * timelines is ever returned to the reporter (FR-REPORT-009).
 */
export interface SubmitReportInput {
  sessionId: string;
  category: ReportCategory;
  note: string | null;
}

export interface SubmitReportOutput {
  reportId: string;
  received: true;
}

export interface ReportsPort {
  submitReport(
    reporterIdentityId: string,
    input: SubmitReportInput,
  ): Promise<SubmitReportOutput>;
  getReport(reportId: string): Promise<Report | null>;
}

export const createNotImplementedReportsPort = (): ReportsPort => ({
  async submitReport(
    _reporterIdentityId: string,
    _input: SubmitReportInput,
  ): Promise<SubmitReportOutput> {
    throw new Error('Not implemented: T-REPORT-006');
  },
  async getReport(_reportId: string): Promise<Report | null> {
    throw new Error('Not implemented: T-REPORT-006');
  },
});
