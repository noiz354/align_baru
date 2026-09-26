/**
 * Attendance contracts.
 * Specification: ATTENDANCE.md, ADR-0025 (constraints; no stored counters; walk-in convergence).
 * Invariants:
 *   1. One record per (event, registration) and per (event, walk_in_ref) - enforced by the database.
 *   2. Corrections are append-only revisions with a mandatory reason; the original fact is never edited.
 *   3. NO_SHOW is derived at window close and never persisted as a record.
 *   4. Counts are derived, reconciled hourly, and drift must be zero.
 * Privacy: the default projection has NO contact fields; contacts require an explicit permission and
 *   are audited (T-ATTEND-006).
 */
export type AttendanceSource = "QR" | "SHORT_CODE" | "NAME_LOOKUP" | "WALK_IN" | "MANUAL_ENTRY" | "CORRECTION";

export interface AttendanceSummary {
  readonly eventId: string;
  readonly registered: number;
  readonly checkedIn: number;
  readonly walkIn: number;
  /** Only meaningful after the window closes; before that this is reported as "belum check-in". */
  readonly noShow: number;
  readonly cancelled: number;
  readonly methodBreakdown: Readonly<Record<AttendanceSource, number>>;
  readonly dataQualityNote?: string;  // e.g. manual share > 10%
  readonly asOf: string;
}
