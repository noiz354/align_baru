/**
 * API ROUTE SHELL - POST /api/v1/recordings/[sessionId]/complete
 *
 * Status: Phase 0. Unimplemented behaviour throws `Not implemented: T-AUDIO-004` (AGENTS.md §4.1): a fake
 * success is forbidden, and a 200 with no effect would be worse than an error.
 * Owning task: T-AUDIO-004 · Contract: API.md (API-0xx) · Requirements: FR-AUDIO-008
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
 * Permissions: audio.record
 * Marks the client flush complete; assembly eligibility is computed server-side. */
export async function POST(): Promise<Response> {
  throw new Error("Not implemented: T-AUDIO-004");
}
