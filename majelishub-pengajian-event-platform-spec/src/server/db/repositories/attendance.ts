/**
 * Attendance repository - the only code that reads/writes attendance rows.
 *
 * Where this belongs: server/db/repositories.
 * Specification: DATA_MODEL.md §attendance, ADR-0025, TASKS.md T-CHECKIN-014 / T-ATTEND-001…007.
 * Invariants:
 *   1. `insertIfAbsent` relies on `UNIQUE (event_id, registration_id)` /
 *      `UNIQUE (event_id, walk_in_ref)` with `ON CONFLICT DO NOTHING RETURNING` - never read-then-write.
 *   2. Row existence is returned explicitly so the caller can answer ALREADY_CHECKED_IN with the
 *      ORIGINAL time (C2).
 *   3. Counters are never stored; summaries are queries (reconciled hourly; drift must be zero).
 *   4. Corrections are separate append-only rows with a mandatory reason.
 *   5. The default projection contains NO contact columns (T-ATTEND-006).
 * Task ownership: T-ATTEND-001/004/007, T-CHECKIN-014.
 */
export interface AttendanceRepoRow {
  readonly attendanceId: string;
  readonly eventId: string;
  readonly registrationId: string | null;
  readonly walkInRef: string | null;
  readonly source: import("@/shared/contracts/attendance").AttendanceSource;
  readonly checkedInAt: string;
  readonly entranceId: string | null;
  readonly operatorUserId: string | null;
}

export interface AttendanceRepository {
  insertIfAbsent(input: { eventId: string; registrationId: string | null; walkInRef: string | null; source: import("@/shared/contracts/attendance").AttendanceSource; checkedInAt: string; entranceId?: string; operatorUserId: string }): Promise<{ inserted: boolean; row: AttendanceRepoRow }>;
  findByRegistration(eventId: string, registrationId: string): Promise<AttendanceRepoRow | null>;
  /** Derived counts only - never a stored counter. */
  countsForEvent(eventId: string): Promise<{ checkedIn: number; walkIn: number }>;
}

/** @throws Error("Not implemented: T-ATTEND-001") */
export function attendanceRepository(scope: import("@/shared/contracts/scope").TenantScope): AttendanceRepository {
  throw new Error("Not implemented: T-ATTEND-001");
}
