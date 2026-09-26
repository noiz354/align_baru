/**
 * API ROUTE SHELL - POST /api/v1/events/[eventId]/attendance/[attendanceId]/corrections
 *
 * Status: Phase 0. Unimplemented behaviour throws `Not implemented: T-ATTEND-004` (AGENTS.md §4.1): a fake
 * success is forbidden, and a 200 with no effect would be worse than an error.
 * Owning task: T-ATTEND-004 · Contract: API.md (API-0xx) · Requirements: FR-ATTEND-007
 *
 * Every implementation must provide, without exception:
 *   - authentication/authorization through requirePermission (server-side; UI hiding is not a control)
 *   - input validation against a schema in src/shared/validation/**
 *   - tenant scoping (cross-organization access returns 404 - ADR-0017)
 *   - idempotency where the operation mutates state (Idempotency-Key header; ADR-0015)
 *   - a typed error from src/shared/contracts/errors.ts, never a bare string
 *   - telemetry inside the allow-list (no tokens, contacts, transcript text) - OBSERVABILITY.md §7
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permissions: attendance.correct (reason >= 8 chars)
 * Append-only; the original fact and time are never edited. */
export async function POST(): Promise<Response> {
  throw new Error("Not implemented: T-ATTEND-004");
}
