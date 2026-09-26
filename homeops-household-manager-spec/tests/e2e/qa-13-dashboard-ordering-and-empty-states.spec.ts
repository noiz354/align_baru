import { test } from '@playwright/test';

/**
 * QA-13 - Dashboard ordering and empty states (mirrors QA.md section 2; keep both in step).
 * Viewport: M, T, D · Requirements: FR-DASH-001..006, DESIGN §9 · Owning task: T-DASH-001.
 *
 * Steps: Open `/today`; collapse a card; hide a card in settings; then resolve everything and re-open.
 * Expected: Cards appear in the documented order (Urgent → Due today → Overdue → Quick actions → Room status → Low supplies → Maintenance → Upcoming → Recent activity); empty cards are hidden; the "All clear" state appears with a useful action when nothing needs attention; ordering never shuffles between loads.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-13 Dashboard ordering and empty states [M, T, D]', () => {
  test.fixme('happy path: Open `/today`; collapse a card; hide a card in settings; then resolve everything and re-open.', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: No data at all (new household)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: only INFO alerts', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: 20 due-today items (list bounded with view all)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: a card whose section fails (E-7 partial failure, page still usable)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: 200% zoom', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: reduced motion.', async () => {
    // Skeleton only.
  });
});
