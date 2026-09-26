/**
 * ROUTE SHELL - /kajian/[id]/audio
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Audio assets: versions, playback, policy, download.
 * Requirements: FR-AUDIO-009/010/011/017, FR-CONTENT-001
 * Owning task: T-AUDIO-011
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: audio.read / audio.process / audio.publish
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: asset PARTIAL (gaps disclosed) · processing failed · INTERNAL policy (no public player)
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-AUDIO-011): Audio assets: versions, playback, policy, download.
  return null;
}
