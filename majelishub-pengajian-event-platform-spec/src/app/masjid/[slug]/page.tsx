/**
 * ROUTE SHELL - /masjid/[slug]
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Mosque profile: venues, facilities, accessibility, upcoming kajian, contact if published.
 * Requirements: FR-MOSQUE-002/003/004
 * Owning task: T-MOSQUE-003
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: public
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: no upcoming events · mosque marked closed · unverified accessibility data
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-MOSQUE-003): Mosque profile: venues, facilities, accessibility, upcoming kajian, contact if published.
  return null;
}
