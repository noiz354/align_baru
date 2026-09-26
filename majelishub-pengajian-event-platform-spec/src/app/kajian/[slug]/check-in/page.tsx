/**
 * ROUTE SHELL - /kajian/[id]/check-in
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Entrance console: camera scanning, manual entry, walk-in.
 * Requirements: FR-CHECKIN-001..016
 * Owning task: T-CHECKIN-002
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: checkin.validate/record/walkin in the bound device context
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: camera denied · degraded network (belum tercatat, never a false success) · window not open/closed · duplicate scan
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-CHECKIN-002): Entrance console: camera scanning, manual entry, walk-in.
  return null;
}
