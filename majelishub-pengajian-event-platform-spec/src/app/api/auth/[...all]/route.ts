/**
 * ROUTE - /api/auth/* (identity handler mount)
 *
 * Owning task: T-ORG-001 · Requirements: NFR-SEC-001, FR-ORG-001/002 · ADR-0005
 *
 * Better Auth owns the sign-in/sign-out/session endpoints; this file only mounts its handler. It holds
 * no business logic: authorization for every product action is enforced by `requirePermission`
 * (T-SEC-002) inside routes and Server Actions, never here.
 *
 * Rate limiting on these paths is durable and shared across replicas (see `src/server/auth/auth.ts`);
 * the library's in-memory default is not used anywhere (SECURITY.md §13). The library's 429 carries a
 * non-standard `x-retry-after`, so the mount adds the `Retry-After` our API contract promises
 * (`src/server/http/auth-response.ts`).
 *
 * Failure cases: identity store unavailable -> 5xx from the handler (never a silent success) · invalid
 * credentials -> the library's own 401 shape · rate limit reached -> 429 with `Retry-After`.
 */
import { auth } from "@/server/auth/auth";
import { withStandardRateLimitHeader } from "@/server/http/auth-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withStandardRateLimitHeader(await auth().handler(request));
}

export async function POST(request: Request): Promise<Response> {
  return withStandardRateLimitHeader(await auth().handler(request));
}
