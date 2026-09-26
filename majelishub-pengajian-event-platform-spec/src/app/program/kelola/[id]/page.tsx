/**
 * ROUTE SHELL - /program/kelola/[id]
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Program editor plus event generation for a date range.
 * Requirements: FR-PROGRAM-002/004/005
 * Owning task: T-PROGRAM-002
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: program.write
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: prayer-time source unavailable (perkiraan flag) · overlapping occurrence detected · zero occurrences generated
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-PROGRAM-002): Program editor plus event generation for a date range.
  return null;
}
