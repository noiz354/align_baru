/**
 * ROUTE SHELL - /kajian/[id]/ubah
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Edit, reschedule or cancel an event.
 * Requirements: FR-EVENT-004/011
 * Owning task: T-EVENT-004
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: event.write; cancellation is reason-required
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: reschedule while registration is open (notification implications stated) · cancel cascade
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-EVENT-004): Edit, reschedule or cancel an event.
  return null;
}
