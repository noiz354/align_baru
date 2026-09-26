/**
 * Accessibility E2E tests — SKELETON.
 *
 * See:
 * - ACCESSIBILITY.md
 * - QA.md §7 (QA-36 … QA-39)
 * - TESTING.md §1.11
 */

import { test } from '@playwright/test';

test.describe('accessibility', () => {
  test.todo('zero critical axe violations on every page');
  test.todo('completes the journey by keyboard alone');
  test.todo('reaches and submits a report using only the keyboard');
  test.todo('announces every session state change');
  test.todo('respects prefers-reduced-motion');
  test.todo('meets the minimum touch target size on every control');
});

test.describe('disconnect states', () => {
  test.todo('distinguishes all six disconnect states');
  test.todo('never discloses moderation reasoning');
});
