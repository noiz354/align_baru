/**
 * ROUTE SHELL - /kajian/[id]/transkrip/tinjau
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Transcript editor: audio plus segments, certainty, revisions.
 * Requirements: FR-TRANSCRIPT-007..010, 015
 * Owning task: T-TRANSCRIPT-006
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: transcript.edit; approval is separate (SoD)
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: revision conflict (409 with diff) · blocking flags unresolved · Arabic/bidi rendering
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-TRANSCRIPT-006): Transcript editor: audio plus segments, certainty, revisions.
  return null;
}
