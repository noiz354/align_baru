/**
 * ROUTE SHELL - /daftar/[eventId]
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): Registration form (<= 4 fields) plus accessibility request.
 * Requirements: FR-REG-001..004, 007, 010, 011
 * Owning task: T-REG-001
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: public capability endpoint; rate limited per contact-hash and IP-hash
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: open · full -> waitlist offer · closed · invitation required · already registered (success-shaped)
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-REG-001): Registration form (<= 4 fields) plus accessibility request.
  return null;
}
