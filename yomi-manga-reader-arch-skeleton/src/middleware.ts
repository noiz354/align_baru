/**
 * Edge middleware — PRESENCE-ONLY session check (ADR-006 security note).
 *
 * Requirement: FR-AUTH-006 (redirect UX only). Task: T-AUTH-007.
 *
 * Contract (normative):
 * - This file NEVER authenticates: it only inspects the cookie's
 *   PRESENCE to decide redirect-to-signin UX. The authoritative check
 *   (DB-verified) is requireUser in server/auth guards (T-AUTH-007).
 * - Route matching here: authenticated pages (library, history,
 *   bookmarks, settings, admin) redirect anonymous visitors to
 *   /auth/signin?next=… (same-origin relative only).
 * - No token parsing, no crypto, no DB access (edge runtime constraint
 *   + security boundary separation).
 */
export function middleware(/* request: NextRequest */): Promise<Response> {
  throw new Error('Not implemented: T-AUTH-007 (edge presence check)');
}

export const config = {
  // TODO(T-AUTH-007): matcher list (authenticated route prefixes only).
  matcher: [],
};
