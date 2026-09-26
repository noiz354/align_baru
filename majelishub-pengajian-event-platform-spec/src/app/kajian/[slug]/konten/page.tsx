/**
 * ROUTE SHELL - /kajian/[id]/konten
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Publication: chapters, materials, references, policy enforcement.
 * Requirements: FR-CONTENT-002/003/006/007
 * Owning task: T-CONTENT-002
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: content.publish / content.withdraw
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: policy INTERNAL · flags unresolved · withdrawal in progress
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-CONTENT-002): Publication: chapters, materials, references, policy enforcement.
  return null;
}
