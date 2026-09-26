import { test } from '@playwright/test';

/**
 * QA-10 - Maintenance due and service record (mirrors QA.md section 2; keep both in step).
 * Viewport: M, D · Requirements: FR-MNT-004, FR-MNT-005, FR-MNT-007, FR-MNT-009 · Owning task: T-MNT-005.
 *
 * Steps: Advance the test clock to the lead window → observe the alert → complete the service with vendor "Teknisi A", cost note → verify next due.
 * Expected: `MAINTENANCE_DUE` at the lead boundary; completing service requires ≤ 3 inputs; `nextServiceAt` recomputes with month clamping; overdue path escalates once; pausing the plan resolves the alert with `PAUSED` and stops future alerts; history shows the record.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-10 Maintenance due and service record [M, D]', () => {
  test.fixme('happy path: Advance the test clock to the lead window → observe the alert → complete the service with vendor Teknisi A, cost note → verify next due.', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Service completed early', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: backdated service (next date shown immediately after save)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: frequency crossing a leap year', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: DST shift', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: household-level plan without an asset', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: vendor performed (`EXTERNAL`, actor null)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: estimated cost left blank.', async () => {
    // Skeleton only.
  });
});
