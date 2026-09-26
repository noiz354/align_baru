import { test } from '@playwright/test';

/**
 * QA-06 - Trash: mark full and collect (mirrors QA.md section 2; keep both in step).
 * Viewport: M · Requirements: FR-TRASH-002, FR-TRASH-003, FR-TRASH-005, FR-TRASH-008 · Owning task: T-TRASH-008.
 *
 * Steps: `/today` → Trash card → "Almost full" → later "Full" → alert appears with "Mark collected" action → tap "Assign to Budi" → switch to Budi's session and complete collection.
 * Expected: `ALMOST_FULL` produces no alert; `FULL` creates exactly one open alert (`TRASH_FULL:container:<id>`) targeted at the assignee with an action; collection resets state to `EMPTY`, resolves the alert automatically, and appears in activity; a second "collected" tap is idempotent; state events recorded for each transition.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-06 Trash: mark full and collect [M]', () => {
  test.fixme('happy path: `/today` → Trash card → Almost full → later Full → alert appears with Mark collected action → tap Assign to Budi → switch to Budis session and complet', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Marking full twice', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: collecting before full (allowed with reason)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: resetting from FULL manually (reason required)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: two containers full at once (two alerts, both individually visible)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: collection when the assigned member was removed', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: schedule window crossing midnight.', async () => {
    // Skeleton only.
  });
});
