/**
 * ROUTE SHELL - /ustadz/[slug]
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Speaker profile: bio, areas of study, affiliation, verification, upcoming/past kajian, published media.
 * Requirements: FR-SPEAKER-001/003/004/007
 * Owning task: T-SPEAKER-003
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: public
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: unverified/unclaimed profile labelling · dispute notice · no content yet
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-SPEAKER-003): Speaker profile: bio, areas of study, affiliation, verification, upcoming/past kajian, published media.
  return null;
}
