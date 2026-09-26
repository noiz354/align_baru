/**
 * ROUTE SHELL - /rekaman/[id]
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Recording page: player, chapters, transcript link, provenance, download if allowed.
 * Requirements: FR-CONTENT-001/002/007
 * Owning task: T-CONTENT-002
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: public with policy check; INTERNAL policy -> neutral explanation page
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: audio not ready · transcript unavailable · withdrawn item (explanation page, never a broken player)
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-CONTENT-002): Recording page: player, chapters, transcript link, provenance, download if allowed.
  return null;
}
