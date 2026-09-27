/**
 * E2E SKELETON - a11y/participant-flow.spec.ts
 * Layer: Playwright (composed stack) · Owning task: T-CHECKIN-002 · Requirement(s): NFR-A11Y-001
 * Scenario: TESTING.md §6.3 · Specification: ACCESSIBILITY.md §5/§6
 * Phase 0: each step is registered with `test.fixme(title, async () => {})` - Playwright's declared-but-
 * not-executed form (Playwright has no `test.todo`, and `test.fixme(title)` with a single string is not
 * a valid signature) - so the scenario is machine-checkable and cannot drift from the spec while
 * nothing is implemented. Fake media devices and network conditions are
 * configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: accessibility is only real if it is verified on the flows people actually use.
 */
import { test } from "@playwright/test";

test.describe("accessibility on P0 flows", () => {
  test.fixme("axe reports zero critical violations on discovery, event detail, registration and code pages", async () => {});
  test.fixme("the keyboard-only script completes registration, code display and check-in console entry", async () => {});
  test.fixme("the check-in result is announced without personal data", async () => {});
  test.fixme("no content is clipped at 200% zoom and all primary targets are at least 56 px", async () => {});
});
