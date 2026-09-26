import { test } from '@playwright/test';

/**
 * QA-05 - Skip, snooze and reassign (mirrors QA.md section 2; keep both in step).
 * Viewport: M · Requirements: FR-CHORE-007, FR-CHORE-008, FR-CHORE-009, FR-ALERT-010 · Owning task: T-CHORE-007.
 *
 * Steps: Chore detail → Skip (reason: "Away") → observe; then create a fresh occurrence → Snooze → "Tomorrow" → verify; then Reassign to Citra.
 * Expected: Skip records an audit row and resolves the overdue alert with reason `SKIPPED`; the completion-anchored series does **not** advance (for AFTER_COMPLETION chores); snooze shows the new due time and no alert fires until it expires; reassignment re-targets the alert recipient and notifies only Citra.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-05 Skip, snooze and reassign [M]', () => {
  test.fixme('happy path: Chore detail → Skip (reason: Away) → observe; then create a fresh occurrence → Snooze → Tomorrow → verify; then Reassign to Citra.', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Snooze beyond the household maximum (rejected with clear copy)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: skip without a reason (rejected)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: reassign to an away member', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: reassign to a removed member', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: reopen a completion within/after 24 h.', async () => {
    // Skeleton only.
  });
});
