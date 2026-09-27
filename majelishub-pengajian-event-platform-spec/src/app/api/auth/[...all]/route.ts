/**
 * Better Auth endpoint handler — `/api/auth/*`.
 *
 * This is the only route the identity library serves directly: sign-in, sign-out, session refresh and
 * the endpoints that T-SEC-009 will add for passkeys. Everything else in the product goes through our
 * own routes and Server Actions, which call `requirePermission` (T-SEC-002).
 *
 * Why a route handler rather than a Server Action: these endpoints set cookies, are called by the
 * client SDK, and must answer with the library's own status codes and headers.
 *
 * Why the handlers are built lazily: constructing the auth instance opens the database pool and reads
 * `APP_URL` / `BETTER_AUTH_SECRET`. Doing that at module scope would make `next build` require a live
 * database and a production secret; deferring it to the first request keeps a missing configuration a
 * runtime failure of one route instead of a failed build.
 *
 * Security:
 *   - Session cookies are HttpOnly/Secure/SameSite=Lax (`src/server/auth/better-auth.ts`).
 *   - Requests are rate limited by the durable store, never the library's in-memory default
 *     (SECURITY.md §13, ADR-0005).
 *   - No token, credential or personal value is logged here; the library's errors are surfaced
 *     unchanged and never enriched with request context.
 *
 * Task ownership: T-ORG-001.
 */
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { auth } from "@/server/auth/better-auth";

type AuthHandlers = ReturnType<typeof toNextJsHandler>;

let handlers: AuthHandlers | undefined;

function authHandlers(): AuthHandlers {
  handlers ??= toNextJsHandler(auth());
  return handlers;
}

export async function GET(request: NextRequest): Promise<Response> {
  return authHandlers().GET(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return authHandlers().POST(request);
}
