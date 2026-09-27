/**
 * E2E SKELETON - a11y/participant-flow.spec.ts
 * Layer: Playwright (composed stack) · Owning task: T-CHECKIN-002 · Requirement(s): NFR-A11Y-001
 * Scenario: TESTING.md §6.3 · Specification: ACCESSIBILITY.md §5/§6
 * Phase 0: each step is registered with `test.fixme(title, () => {})` - a real Playwright API that
 * declares the test and skips it - so the scenario is machine-checkable (`playwright test --list`) and
 * cannot drift from the spec while nothing is implemented. The body is never executed; it names the
 * owning task. `test.todo` does not exist in Playwright - do not reintroduce it. Fake media devices
 * and network conditions are configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: accessibility is only real if it is verified on the flows people actually use.
 */
import { test } from "@playwright/test";

test.describe("accessibility on P0 flows", () => {
  test.fixme("axe reports zero critical violations on discovery, event detail, registration and code pages", () => {
    // Not implemented: T-CHECKIN-002 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("the keyboard-only script completes registration, code display and check-in console entry", () => {
    // Not implemented: T-CHECKIN-002 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("the check-in result is announced without personal data", () => {
    // Not implemented: T-CHECKIN-002 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("no content is clipped at 200% zoom and all primary targets are at least 56 px", () => {
    // Not implemented: T-CHECKIN-002 - replace this placeholder with the real steps when the task lands.
  });});
