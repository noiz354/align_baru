/**
 * ROUTE SHELL - /pendaftaran/[token]
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): My registration and QR - offline-capable, brightness mode.
 * Requirements: FR-REG-009, FR-CHECKIN-003, NFR-MOB-004
 * Owning task: T-REG-005
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: capability token; the code is only meaningful server-side
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * Failure cases to implement: active · already checked-in with time · cancelled · event cancelled · expired
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-REG-005): My registration and QR - offline-capable, brightness mode.
  return null;
}
