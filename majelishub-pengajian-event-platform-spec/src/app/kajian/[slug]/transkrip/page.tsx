/**
 * ROUTE SHELL - /kajian/[id]/transkrip
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Transcription job status and review entry.
 * Requirements: FR-TRANSCRIPT-001..003, 006
 * Owning task: T-TRANSCRIPT-001
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: transcript.request / transcript.read
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: policy forbids transcription · provider disabled · job failed with a retry option
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-TRANSCRIPT-001): Transcription job status and review entry.
  return null;
}
