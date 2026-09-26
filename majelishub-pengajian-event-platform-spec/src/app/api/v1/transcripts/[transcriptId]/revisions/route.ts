/**
 * API ROUTE SHELL - POST /api/v1/transcripts/[transcriptId]/revisions
 *
 * Status: Phase 0. Unimplemented behaviour throws `Not implemented: T-TRANSCRIPT-008` (AGENTS.md §4.1): a fake
 * success is forbidden, and a 200 with no effect would be worse than an error.
 * Owning task: T-TRANSCRIPT-008 · Contract: API.md (API-0xx) · Requirements: FR-TRANSCRIPT-011
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
 * Permissions: transcript.edit
 * Append-only; optimistic concurrency (If-Match) returns 409 with a diff (C6). */
export async function POST(): Promise<Response> {
  throw new Error("Not implemented: T-TRANSCRIPT-008");
}
