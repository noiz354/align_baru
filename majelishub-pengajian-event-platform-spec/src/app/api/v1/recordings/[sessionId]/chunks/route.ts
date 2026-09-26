/**
 * API ROUTE SHELL - POST /api/v1/recordings/[sessionId]/chunks
 *
 * Status: Phase 0. Unimplemented behaviour throws `Not implemented: T-AUDIO-004` (AGENTS.md §4.1): a fake
 * success is forbidden, and a 200 with no effect would be worse than an error.
 * Owning task: T-AUDIO-004 · Contract: API.md (API-031) · Requirements: FR-AUDIO-005..007
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
 * Permissions: audio.record in the session's event scope
 * Success means durable (object + row); 409 on same-sequence-different-hash (C8). */
export async function POST(): Promise<Response> {
  throw new Error("Not implemented: T-AUDIO-004");
}
