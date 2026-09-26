/**
 * ROUTE SHELL - /kajian
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Full discovery list with filters (date, mosque, area, topic, language, accessibility).
 * Requirements: FR-EVENT-014/015
 * Owning task: T-EVENT-003
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: public
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: empty filters result · pagination cursor invalid · invalid date range
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-EVENT-003): Full discovery list with filters (date, mosque, area, topic, language, accessibility).
  return null;
}
