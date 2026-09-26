import { test } from '@playwright/test';

/**
 * QA-12 - Notifications, caps and fatigue controls (mirrors QA.md section 2; keep both in step).
 * Viewport: M (device), D (settings) · Requirements: FR-ALERT-013, FR-NOTIF-004, FR-NOTIF-007, FR-NOTIF-010, NFR-PRIV-008 · Owning task: T-NOTIF-005.
 *
 * Steps: Trigger the grouped resource alert → verify one notification; then trigger five separate due chores in a day → verify the cap produces a digest; toggle quiet hours and verify non-urgent suppression with in-app truth intact; remove the app from the device (simulate dead subscription) and verify cleanup.
 * Expected: No broadcast to Ayu/Citra when Budi is the assigned member; push payload minimal (no titles or notes); suppressed notifications recorded with reasons; dead subscriptions removed silently; "why did I get this?" explains the reason for each alert.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-12 Notifications, caps and fatigue controls [M (device), D (settings)]', () => {
  test.fixme('happy path: Trigger the grouped resource alert → verify one notification; then trigger five separate due chores in a day → verify the cap produces a digest; toggl', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Quiet hours + `URGENT` (must deliver)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: cap reached + `URGENT` (still delivered, counted)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: push permission denied (in-app only, no nagging)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: multiple devices for one member', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: email channel off', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: device timezone vs household timezone.', async () => {
    // Skeleton only.
  });
});
