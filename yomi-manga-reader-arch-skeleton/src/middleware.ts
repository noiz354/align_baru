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
 *
 * ── SPEC-QUESTION (raised by the T-FOUND-003/004/007 lane) ───────────────
 * `matcher: []` is NOT inert in a production build. Measured on Next 16.3.6,
 * Node 24: with `matcher: []` the middleware runs on EVERY path in
 * `next start`, so the `Not implemented` throw below turned the whole app
 * into 500s — including `/healthz`, i.e. it broke the NFR-OBS-004 liveness
 * contract from the outside. `next dev` DOES honour the empty matcher, so the
 * skeleton looked inert in development and failed only in a build, which is
 * the worst way for a skeleton to fail. The matcher below is an unreachable
 * path literal, which is inert in BOTH dev and a production build, and it is
 * what the original TODO asked for: "matches nothing until T-AUTH-007 fills
 * the real list in". Replace it with the authenticated route prefixes.
 * Owner of the permanent fix: T-AUTH-007 (AGENTS.md §6 — recorded, not
 * silently chosen).
 */
export function middleware(/* request: NextRequest */): Promise<Response> {
  throw new Error('Not implemented: T-AUTH-007 (edge presence check)');
}

export const config = {
  // TODO(T-AUTH-007): the authenticated route prefixes
  // (library, history, bookmarks, settings, admin). Until then this matches
  // nothing on purpose — see the SPEC-QUESTION above for why `[]` will not do.
  matcher: ['/__t-auth-007-matcher-not-configured__'],
};
