/**
 * Report E2E tests — SKELETON.
 *
 * See:
 * - QA.md §4 (QA-18 … QA-26)
 * - TESTING.md §1.11
 *
 * These are `describe.todo` placeholders. When implemented, these use
 * Playwright with TWO browser contexts.
 */

import { test } from '@playwright/test';

test.describe('reporting', () => {
  test.todo('submits a report from an active session');
  test.todo('accepts a report after the peer disconnects');
  test.todo('submits a report from the CONNECTING state');
  test.todo('does not tell the peer they were reported');
  test.todo('reaches and submits a report using only the keyboard');
});

test.describe('blocking', () => {
  test.todo('blocks from an active session');
  test.todo('does not immediately rematch blocked participants');
  test.todo('block survives reload');
});

test.describe('entry gating', () => {
  test.todo('redirects direct navigation to /queue without consent');
  test.todo('redirects direct navigation to /chat without consent');
});

test.describe('exit', () => {
  test.todo('exits from every session state');
  test.todo('exits using only the keyboard');
});
