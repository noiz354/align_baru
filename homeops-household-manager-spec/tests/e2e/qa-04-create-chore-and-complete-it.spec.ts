import { test } from '@playwright/test';

/**
 * QA-04 - Create chore and complete it (mirrors QA.md section 2; keep both in step).
 * Viewport: M (primary), D · Requirements: FR-CHORE-004, FR-CHORE-005, FR-CHORE-011, FR-ROOM-003 · Owning task: T-CHORE-004.
 *
 * Steps: Chores → Add → "Clean bathroom" → room Bathroom → priority HIGH → recurrence "Every week on Friday" → save. Then go to `/today` on Friday and tap the chore's "Done" button.
 * Expected: Dashboard shows the chore under "Due today"; one tap completes it; confirmation snackbar with Undo; occurrence marked done; activity lists `ChoreCompleted` with actor; chore detail shows next due date; room status becomes `CLEAN` (rule 5).
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-04 Create chore and complete it [M (primary), D]', () => {
  test.fixme('happy path: Chores → Add → Clean bathroom → room Bathroom → priority HIGH → recurrence Every week on Friday → save. Then go to `/today` on Friday and tap the chor', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Double-tap quickly (only one completion)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: complete from the detail page and from the dashboard simultaneously (no duplicates)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: complete an already-completed occurrence via stale tab (409/idempotent, friendly message)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: complete a chore for a room that was archived', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: complete with an optional note', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: network drop mid-action (E-1 error + retry, no partial state).', async () => {
    // Skeleton only.
  });
});
