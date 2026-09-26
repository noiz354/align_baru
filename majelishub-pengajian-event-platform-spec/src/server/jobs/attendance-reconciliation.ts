/**
 * Attendance reconciliation - derives counts and detects drift (must be zero).
 *
 * Where this belongs: server/jobs.
 * Specification: ATTENDANCE.md §6, ADR-0025 (no stored counters), TASKS.md T-ATTEND-007.
 * Invariants: read-only; drift > 0 raises an alert and is treated as an incident, not a nuisance;
 *   the job never "fixes" counts by writing a counter (there are none); it reports derived values with
 *   an as-of timestamp so exports and dashboards agree.
 * Task ownership: T-ATTEND-007.
 */
export interface DriftReport {
  readonly eventId: string;
  readonly derivedCheckedIn: number;
  readonly derivedWalkIn: number;
  readonly drift: number;
  readonly asOf: string;
}

/** @throws Error("Not implemented: T-ATTEND-007") */
export async function reconcileEvent(eventId: string): Promise<DriftReport> {
  throw new Error("Not implemented: T-ATTEND-007");
}
