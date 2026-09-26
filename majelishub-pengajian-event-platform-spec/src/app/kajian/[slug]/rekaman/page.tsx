/**
 * ROUTE SHELL - /kajian/[id]/rekaman
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Recording console: start/pause/stop, health, recovery.
 * Requirements: FR-AUDIO-001..017
 * Owning task: T-AUDIO-001
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: audio.record in the event scope; policy acknowledgement required
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: microphone denied · device lost · upload backlog · policy not acknowledged
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-AUDIO-001): Recording console: start/pause/stop, health, recovery.
  return null;
}
