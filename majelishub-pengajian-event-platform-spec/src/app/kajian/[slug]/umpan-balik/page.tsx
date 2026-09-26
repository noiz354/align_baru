/**
 * ROUTE SHELL - /kajian/[id]/umpan-balik
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Feedback review (aggregates plus comments; speakers see a filtered view).
 * Requirements: FR-FEEDBACK-004/006
 * Owning task: T-FEEDBACK-003
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: feedback.read; speaker view is narrower and never comparative
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: n < 5 suppression explained · no responses yet · hidden comments
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-FEEDBACK-003): Feedback review (aggregates plus comments; speakers see a filtered view).
  return null;
}
