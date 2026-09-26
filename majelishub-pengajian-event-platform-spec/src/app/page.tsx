/**
 * ROUTE SHELL - /
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Today/this week nearby: 'Kajian apa yang tersedia?'.
 * Requirements: FR-EVENT-014, NFR-PERF-001
 * Owning task: T-EVENT-003
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: public - no permission required; cancelled/unpublished events absent
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: no events today · offline cache available · partial data when a remote timezone differs
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-EVENT-003): Today/this week nearby: 'Kajian apa yang tersedia?'.
  return null;
}
