/**
 * Public surfaces - the complete, auditable list of routes that need no permission check.
 *
 * Where this belongs: `server/auth`, next to `requirePermission`. SECURITY.md §3: "there is no
 * 'public by default' path except the explicitly listed public read operations (`API.md` §2)". ADR-0017
 * layer 5 requires public exemptions to be "listed in one auditable place" - this is that place for
 * routes; `src/features/content/public-projections.ts` is the equivalent for public queries.
 *
 * Rules:
 *   1. A route may only appear here if it exposes no tenant-scoped data and performs no mutation, or if
 *      it is authenticated by a different mechanism (the identity handler authenticates by definition).
 *   2. Every entry states why it is public.
 *   3. `tests/integration/security/permissions.test.ts` fails when a route file is neither authorized
 *      nor listed here, and when an entry here has no route behind it.
 *
 * Task ownership: T-SEC-002. Grows with every public surface added by later slices (discovery pages in
 * VS-2, participant capability routes in VS-3).
 */
export interface PublicRoute {
  /** Route path as it appears under `src/app/`. */
  readonly path: string;
  readonly reason: string;
}

export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  {
    path: "/api/v1/health",
    reason: "Liveness/readiness probe. Returns no configuration, no versions and no data (API.md health).",
  },
  {
    path: "/api/auth/[...all]",
    reason:
      "Identity handler (ADR-0005). It authenticates rather than authorizes; it is rate limited through the durable store and holds no business logic.",
  },
];

export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => route.path === path);
}
