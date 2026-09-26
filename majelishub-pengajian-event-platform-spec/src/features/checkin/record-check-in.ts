/**
 * Record a validated check-in as exactly one durable attendance record.
 *
 * Where this belongs: application layer (features/checkin); the only writer of attendance from the
 * entrance. See TASKS.md T-CHECKIN-014 for the full sixteen-field task definition.
 * Why it is not implemented yet: roadmap slice VS-4.
 *
 * Invariants: at most one attendance row per (event, registration) / (event, walk-in ref); success
 *   means the row is committed; ALREADY_CHECKED_IN carries the ORIGINAL time and never creates a row;
 *   attendance is append-only (corrections are separate rows with reasons, ADR-0025).
 * Security: requires `checkin.record` in the event scope; the operator identity is stored; the token is
 *   never logged or returned.
 * Privacy: no participant history is created; contacts are not touched.
 * Concurrency: **C2** - use `INSERT ... ON CONFLICT DO NOTHING RETURNING` (never read-then-write).
 * Failure cases: cancelled registration · window closed · wrong context · DB unavailable (a distinct
 *   UNAVAILABLE result, never a success) · duplicate submission (idempotent).
 * Tests: tests/integration/attendance/record-checkin.test.ts, tests/integration/attendance/duplicate-scan.test.ts.
 */
import type { CheckInAttempt, CheckInResult } from "@/shared/contracts/checkin";

export interface RecordCheckInInput {
  readonly attempt: CheckInAttempt;
  readonly validatedKind: "VALID";
  readonly scope: import("@/shared/contracts/scope").TenantScope;
}

/**
 * @throws Error("Not implemented: T-CHECKIN-014")
 */
export async function recordCheckIn(input: RecordCheckInInput): Promise<CheckInResult> {
  throw new Error("Not implemented: T-CHECKIN-014");
}
