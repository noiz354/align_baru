import { test } from '@playwright/test';

/**
 * QA-09 - Report and resolve an issue (mirrors QA.md section 2; keep both in step).
 * Viewport: M · Requirements: FR-ISSUE-001..009 · Owning task: T-ISSUE-002.
 *
 * Steps: `/today` → "Report issue" → title "Leaking tap" → room Bathroom → severity HIGH → attach photo → submit.
 * Expected: Completed in ≤ 20 s; issue appears with `OPEN`; HIGH severity raises an alert immediately; assign → acknowledge → in progress → resolve with a follow-up chore; alert auto-resolves with reason; transitions recorded; HELPER cannot close the issue (role rule).
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-09 Report and resolve an issue [M]', () => {
  test.fixme('happy path: `/today` → Report issue → title Leaking tap → room Bathroom → severity HIGH → attach photo → submit.', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: SAFETY severity creates an `URGENT` alert bypassing quiet hours', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: no photo (allowed)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: oversized/EXIF-laden photo (stripped, bounded)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: duplicate submissions (idempotent)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: comment on a closed issue (rejected with explanation)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: WONT_FIX without reason (rejected).', async () => {
    // Skeleton only.
  });
});
