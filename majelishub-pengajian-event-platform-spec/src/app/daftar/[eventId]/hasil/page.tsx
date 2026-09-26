/**
 * ROUTE SHELL - /daftar/[eventId]/hasil
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Registration result: status, QR, short code, add-to-calendar, screenshot hint.
 * Requirements: FR-REG-003/009
 * Owning task: T-REG-005
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: capability token in the URL (never a raw id)
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: registered · waitlisted with position · rejected with reason
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-REG-005): Registration result: status, QR, short code, add-to-calendar, screenshot hint.
  return null;
}
