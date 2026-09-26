/**
 * API ROUTE SHELL - GET /api/v1/transcripts/[transcriptId]
 *
 * Status: Phase 0. Unimplemented behaviour throws `Not implemented: T-TRANSCRIPT-006` (AGENTS.md §4.1): a fake
 * success is forbidden, and a 200 with no effect would be worse than an error.
 * Owning task: T-TRANSCRIPT-006 · Contract: API.md (API-0xx) · Requirements: FR-TRANSCRIPT-007
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
 * Permissions: transcript.read
 * Drafts are visible only to reviewers; the public projection is a different route. */
export async function GET(): Promise<Response> {
  throw new Error("Not implemented: T-TRANSCRIPT-006");
}
