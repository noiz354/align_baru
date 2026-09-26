import { test } from '@playwright/test';

/**
 * QA-03 - Create room (mirrors QA.md section 2; keep both in step).
 * Viewport: M, D · Requirements: FR-ROOM-001, FR-ROOM-003, FR-ROOM-007 · Owning task: T-ROOM-001.
 *
 * Steps: Rooms → Add → "Bathroom" → group "Upstairs" → reorder.
 * Expected: Room appears with state `UNKNOWN` and explanation "No chores tracked for this room yet"; ordering persists; duplicate name rejected with a field error.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-03 Create room [M, D]', () => {
  test.fixme('happy path: Rooms → Add → Bathroom → group Upstairs → reorder.', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Duplicate name differing in case/whitespace', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: very long name', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: emoji/unicode name', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: 50-room soft limit', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: archiving a room with an open chore', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: renaming a room that chores reference.', async () => {
    // Skeleton only.
  });
});
