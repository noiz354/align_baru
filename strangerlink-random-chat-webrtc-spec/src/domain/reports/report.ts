/**
 * Report domain types — real implementation.
 */

import type { ReportCategory } from '../../shared/contracts/signaling';

export type ReportSeverity = 'P0' | 'P1' | 'P2';
export type ReportStatus = 'open' | 'triaged' | 'actioned' | 'insufficient' | 'escalated' | 'closed';

export interface Report {
  id: string;
  sessionId: string;
  reporterIdentityId: string;
  peerIdentityId: string;
  category: ReportCategory;
  severity: ReportSeverity;
  note: string | null;
  dedupKey: string;
  status: ReportStatus;
  createdAt: Date;
}

export const MAX_REPORT_NOTE_LENGTH = 1000;
export const REPORTS_PER_HOUR = 5;

export const P0_CATEGORIES: readonly ReportCategory[] = [
  'minor-safety',
  'illegal-content',
  'threats',
];

export function severityForCategory(category: ReportCategory): ReportSeverity {
  if ((P0_CATEGORIES as readonly string[]).includes(category)) return 'P0';
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

export function reportDedupKey(sessionId: string, category: ReportCategory): string {
  return `${sessionId}:${category}`;
}

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
