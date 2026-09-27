/**
 * Reports service — real implementation.
 *
 * Requirements:
 * - FR-REPORT-001 … FR-REPORT-010
 * - T-REPORT-006, T-REPORT-016
 * - INV-8 (report may reference terminal session)
 * - ADR-011
 */

import type { ReportCategory } from '../../shared/contracts/signaling';
import { reportStore, sessionStore, safetyEventStore, moderationStore, rateLimitStore, participantStore } from '../../server/db/in-memory';

export interface SubmitReportInput {
  sessionId: string;
  category: ReportCategory;
  note: string | null;
}

export interface ReportAcknowledgement {
  reportId: string;
  received: true;
}

export interface ReportsService {
  submitReport(
    reporterIdentityId: string,
    input: SubmitReportInput,
  ): Promise<ReportAcknowledgement>;
}

export const createReportsService = (): ReportsService => ({
  async submitReport(
    reporterIdentityId: string,
    input: SubmitReportInput,
  ): Promise<ReportAcknowledgement> {
    // Rate limit: 5/hour per identity (FR-REPORT-007, T-ABUSE-061)
    const rl = rateLimitStore.check(reporterIdentityId, 'reportsPerHour');
    if (!rl.allowed) {
      safetyEventStore.record('rate-limit-triggered', reporterIdentityId, input.sessionId, {
        limit: 'reportsPerHour',
        retryAfterMs: rl.retryAfterMs ?? 0,
      });
      throw new Error(`RATE_LIMITED: reports per hour exceeded`);
    }

    // Session must exist, but may be terminal (INV-8, FR-REPORT-002)
    const session = sessionStore.get(input.sessionId);
    if (!session) {
      throw new Error('NOT_FOUND: session not found');
    }

    // Authorization: reporter must be participant of session (but banned users can still report)
    if (session.participantAId !== reporterIdentityId && session.participantBId !== reporterIdentityId) {
      throw new Error('FORBIDDEN: not participant of session');
    }

    // Determine peer id
    const peerId = session.participantAId === reporterIdentityId ? session.participantBId : session.participantAId;

    // Validate category
    const validCategories: ReportCategory[] = ['harassment', 'sexual-content', 'minor-safety', 'threats', 'hate', 'spam', 'scam', 'illegal-content', 'other'];
    if (!validCategories.includes(input.category)) {
      throw new Error('VALIDATION_FAILED: invalid category');
    }

    // Sanitize note: max 1000 chars, no personal data collection beyond note itself
    let sanitizedNote: string | null = null;
    if (input.note) {
      sanitizedNote = input.note.slice(0, 1000).trim();
      // Basic sanitization: strip HTML
      sanitizedNote = sanitizedNote.replace(/<[^>]*>/g, '');
      if (sanitizedNote.length === 0) sanitizedNote = null;
    }

    // Dedup on (session, category) — FR-REPORT-006
    const { report, isNew } = reportStore.create(input.sessionId, reporterIdentityId, peerId, input.category, sanitizedNote);

    if (isNew) {
      // Create moderation case
      const modCase = moderationStore.createCase(report.id, report.sessionId, report.severity);

      // P0 escalation — bypass normal triage, page on-call (FR-SAFE-008, SAFETY.md §8.1)
      if (report.severity === 'P0') {
        safetyEventStore.record('escalation-raised', reporterIdentityId, input.sessionId, {
          reportId: report.id,
          category: report.category,
          severity: report.severity,
        });
        // In production, this would page on-call via PagerDuty/Opsgenie
        // Here we record safety event for observability
      }

      safetyEventStore.record('session-terminated', reporterIdentityId, input.sessionId, {
        reason: 'report',
        category: report.category,
      });
    }

    // Return acknowledgement without moderation reasoning (FR-REPORT-009, NFR-SAFE-002)
    return {
      reportId: report.id,
      received: true,
    };
  },
});

export interface ReportCredibilityService {
  weightFor(identityId: string): Promise<number>;
}

export const createReportCredibilityService = (): ReportCredibilityService => ({
  async weightFor(identityId: string): Promise<number> {
    // T-REPORT-016: detect and down-weight report flooding and retaliation
    // An identity reporting many distinct peers is down-weighted and flagged, not banned
    const reports = reportStore.findByReporter(identityId);
    const distinctPeers = new Set(reports.map(r => r.peerIdentityId));

    // If reporting >10 distinct peers in short window, down-weight
    if (distinctPeers.size > 10) {
      safetyEventStore.record('rate-limit-triggered', identityId, null, {
        limit: 'report-credibility',
        distinctPeers: distinctPeers.size,
      });
      return 0.2; // heavily down-weighted
    }
    if (distinctPeers.size > 5) {
      return 0.5;
    }
    return 1.0;
  },
});
