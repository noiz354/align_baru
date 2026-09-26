/**
 * ROUTE SHELL - /transkrip/[id]
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Published, human-reviewed transcript with timestamp navigation and provenance header.
 * Requirements: FR-TRANSCRIPT-011/012/013, FR-CONTENT-002
 * Owning task: T-CONTENT-002
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: public projections; unpublished draft visible only to reviewers
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: draft state (reviewers only) · unpublished · partial coverage disclosed
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-CONTENT-002): Published, human-reviewed transcript with timestamp navigation and provenance header.
  return null;
}
