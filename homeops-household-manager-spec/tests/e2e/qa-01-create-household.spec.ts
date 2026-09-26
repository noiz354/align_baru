import { test } from '@playwright/test';

/**
 * QA-01 - Create household (mirrors QA.md section 2; keep both in step).
 * Viewport: M, D · Requirements: FR-HH-001, FR-HH-002, FR-HH-005, FR-HH-012 · Owning task: T-HH-001.
 *
 * Steps: `/` → "Create household" → name "Rumah Ayu" → timezone "Asia/Jakarta" → week start Monday → Save.
 * Expected: Redirect to `/today`; empty dashboard shows the "All clear / get started" state; creator listed as OWNER in `/settings/members`; exactly one household row created; `HouseholdCreated` in activity.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-01 Create household [M, D]', () => {
  test.fixme('happy path: `/` → Create household → name Rumah Ayu → timezone Asia/Jakarta → week start Monday → Save.', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Empty name', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: 61-char name', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: invalid timezone', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: double-submit', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: two tabs submitting simultaneously', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: user who already has a household (must get `HOUSEHOLD_ALREADY_EXISTS`, not a second household).', async () => {
    // Skeleton only.
  });
});
