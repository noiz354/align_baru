import { test } from '@playwright/test';

/**
 * QA-15 - Accessibility pass (per UI slice) (mirrors QA.md section 2; keep both in step).
 * Viewport: M, D · Requirements: NFR-A11Y-001..008 · Owning task: T-A11Y-001 (harness) plus each slice's A11Y assertions.
 *
 * Steps: Keyboard-only pass through `/today` → complete a chore → acknowledge an alert; screen reader pass (VoiceOver/NVDA) on the same path; contrast check on status badges in light and dark; zoom to 200%; enable reduced motion; axe run.
 * Expected: Every action reachable and operable by keyboard with visible focus; status announced as words ("Bathroom: dirty, overdue by 2 days"); live-region confirmations polite, urgent alerts assertive once; contrast ratios met; no motion required to understand state; axe clean (no new violations).
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-15 Accessibility pass (per UI slice) [M, D]', () => {
  test.fixme('happy path: Keyboard-only pass through `/today` → complete a chore → acknowledge an alert; screen reader pass (VoiceOver/NVDA) on the same path; contrast check on', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Focus after navigation', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: Escape closing sheets', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: error summary on multi-field forms', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: long list announcements', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: screen-reader behaviour of optimistic updates', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: colour-blind simulation of status colours.', async () => {
    // Skeleton only.
  });
});
