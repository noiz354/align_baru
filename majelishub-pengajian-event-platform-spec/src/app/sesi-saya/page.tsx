/**
 * ROUTE SHELL - /sesi-saya
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Device and session management.
 * Requirements: NFR-SEC-011
 * Owning task: T-ORG-004 (the session service it lists is T-ORG-001, delivered)
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: session
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: revoke own session · concurrent sessions listed
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-ORG-004): Device and session management.
  // Deferred from T-ORG-001: listing and revoking sessions needs the authorization gate (T-SEC-002),
  // because revoking someone else's session must never depend on the client.
  return null;
}
