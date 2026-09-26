/**
 * API ROUTE SHELL - POST /api/v1/checkin/validate
 *
 * Status: Phase 0. Unimplemented behaviour throws `Not implemented: T-CHECKIN-001` (AGENTS.md §4.1): a fake
 * success is forbidden, and a 200 with no effect would be worse than an error.
 * Owning task: T-CHECKIN-001 · Contract: API.md (API-0xx) · Requirements: FR-CHECKIN-003..005
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
 * Permissions: checkin.validate
 * One outcome per attempt; ALREADY_CHECKED_IN is success-shaped; UNAVAILABLE is never success. */
export async function POST(): Promise<Response> {
  throw new Error("Not implemented: T-CHECKIN-001");
}
