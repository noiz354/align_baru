/**
 * Attendance: summary, corrections with reasons, exports (with field selection) and reconciliation.
 *
 * Where this belongs: features/attendance.
 * Specification: ATTENDANCE.md, ADR-0025, TASKS.md T-ATTEND-001…T-ATTEND-008.
 * Invariants: counts are derived, never stored; drift must be zero (reconciliation job alerts);
 *   corrections are append-only with a mandatory reason (>= 8 chars) and are audited; NO_SHOW is derived
 *   only after the window closes.
 * Privacy: the DEFAULT projection has no contact fields; explicit contact selection is permission-gated
 *   and audited (T-ATTEND-006).
 * Concurrency: C4 (walk-in convergence), C5 (concurrent corrections), C12 (retention overlap).
 * Failure cases: export requested without permission · contact withdrawn between request and generation
 *   · large export timeouts · repeated export spam.
 * Task ownership: T-ATTEND-002/004/005/007.
 */
import type { AttendanceSummary } from "@/shared/contracts/attendance";

/** @throws Error("Not implemented: T-ATTEND-002") */
export async function loadAttendanceSummary(input: { eventId: string; scope: import("@/shared/contracts/scope").TenantScope }): Promise<AttendanceSummary> {
  throw new Error("Not implemented: T-ATTEND-002");
}

/** @throws Error("Not implemented: T-ATTEND-004") */
export async function correctAttendance(input: { attendanceId: string; action: "ADD" | "REMOVE" | "TIME_CORRECTION" | "METHOD_CORRECTION"; reason: string; actor: import("@/shared/contracts/permissions").Actor }): Promise<void> {
  throw new Error("Not implemented: T-ATTEND-004");
}

/** @throws Error("Not implemented: T-ATTEND-005") */
export async function requestAttendanceExport(input: { eventId: string; fields: readonly string[]; actor: import("@/shared/contracts/permissions").Actor }): Promise<{ exportId: string }> {
  throw new Error("Not implemented: T-ATTEND-005");
}
