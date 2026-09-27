/**
 * ROUTE SHELL - /masuk
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Sign-in for organizers (magic link / passkey). Participants never need an account.
 * Requirements: NFR-SEC-001/010
 * Owning task: T-ORG-004 (the identity platform it sits on is T-ORG-001, delivered)
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: public endpoint with durable rate limits
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: link sent · expired link · rate limited
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-ORG-004): Sign-in for organizers (magic link / passkey). Participants never need an account.
  // Deferred from T-ORG-001: magic link needs the VS-12 email channel and passkeys are T-SEC-009, so
  // this surface cannot be exercised end to end until one of them exists.
  return null;
}
