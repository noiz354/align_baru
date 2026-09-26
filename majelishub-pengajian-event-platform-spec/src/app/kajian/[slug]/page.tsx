/**
 * ROUTE SHELL - /kajian/[slug]
 *
 * Status: Phase 0 skeleton. This file renders NOTHING (`return null`) on purpose: placeholder UI that
 * could be mistaken for the product is forbidden (DESIGN.md phase rule, AGENTS.md §5.3).
 * Purpose (route PAGES.md): The decision screen: speaker, mosque, venue, schedule, capacity, accessibility, recording policy.
 * Requirements: FR-EVENT-010/015/016
 * Owning task: T-EVENT-003
 *
 * Where the real implementation belongs and what it must respect:
 *   - Data comes from a feature service (src/features/**), never from the database directly.
 *   - Permissions: public
 *   - Accessible from the first commit: keyboard reachable, focus visible, targets >= 56 px on mobile,
 *     live-region announcements without personal data (ACCESSIBILITY.md).
 *   - Honest states are mandatory: loading, empty, error, offline/degraded - never a fake success.
 * ROLE-AWARE VIEW (Next.js segment-name constraint, PAGES.md route naming note): this single route
 * serves both the public decision screen and the organizer view listed as `/kajian/[id]` in PAGES.md.
 * Branching happens SERVER-SIDE from permissions (event.read / event.write): the console sections
 * (status, readiness checklist, publish action) render only for authorized roles, and the URL never
 * grants access. Organizer checklist + publish: T-EVENT-002. Sibling organizer consoles live under this
 * same segment: check-in (T-CHECKIN-002), peserta (T-REG-002), kehadiran (T-ATTEND-002), rekaman
 * (T-AUDIO-001), audio (T-AUDIO-011), transkrip (T-TRANSCRIPT-001), konten (T-CONTENT-002),
 * umpan-balik (T-FEEDBACK-003).
 * Failure cases to implement: event full (waitlist offer) · registration closed · cancelled · in progress · completed with media
 */

export const dynamic = "force-dynamic"; // correct while nothing is cached; revisit with the real data layer

export default async function Page()  {
  // TODO(T-EVENT-003): The decision screen: speaker, mosque, venue, schedule, capacity, accessibility, recording policy.
  return null;
}
