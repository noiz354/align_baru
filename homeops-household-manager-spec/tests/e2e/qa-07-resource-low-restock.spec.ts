import { test } from '@playwright/test';

/**
 * QA-07 - Resource low → restock (mirrors QA.md section 2; keep both in step).
 * Viewport: M · Requirements: FR-RES-004, FR-RES-005, FR-RES-007, FR-RES-008, FR-RES-009 · Owning task: T-RES-014.
 *
 * Steps: Set toilet paper to LOW; decrement rice to 2 (crossing threshold); toggle water to unavailable; open `/today` and the shopping list.
 * Expected: One grouped `RESOURCE_LOW` alert listing items (not three separate notifications); CRITICAL/UNAVAILABLE items individually visible in the alert body and attention strip; shopping list shows all three with quantity hints; "Restocked" on water resolves the water contribution and the alert updates.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-07 Resource low → restock [M]', () => {
  test.fixme('happy path: Set toilet paper to LOW; decrement rice to 2 (crossing threshold); toggle water to unavailable; open `/today` and the shopping list.', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Crossing thresholds repeatedly within a day (no repeated notifications)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: mode change resets level with confirmation', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: restock to target for EXACT', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: deleting/archiving a resource with an open need', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: item bought manually without a linked resource.', async () => {
    // Skeleton only.
  });
});
