/**
 * E2E SKELETON - waitlist-flow.spec.ts
 * Layer: Playwright (composed stack) · Owning task: T-REG-003 · Requirement(s): FR-REG-005/006
 * Scenario: TESTING.md §6.3 · Specification: TESTING.md §6.3 scenario 6
 * Phase 0: each step is registered with `test.fixme(title, () => {})` - a real Playwright API that
 * declares the test and skips it - so the scenario is machine-checkable (`playwright test --list`) and
 * cannot drift from the spec while nothing is implemented. The body is never executed; it names the
 * owning task. `test.todo` does not exist in Playwright - do not reintroduce it. Fake media devices
 * and network conditions are configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: capacity pressure is normal for popular kajian; the waitlist must feel fair and be honest.
 */
import { test } from "@playwright/test";

test.describe("waitlist flow", () => {
  test.fixme("a full event offers the waitlist with a clear explanation instead of a failure", () => {
    // Not implemented: T-REG-003 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("a cancellation creates an offer for the next waitlisted participant with an expiry", () => {
    // Not implemented: T-REG-003 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("accepting the offer reuses the same registration and code", () => {
    // Not implemented: T-REG-003 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("an expired offer returns the participant to the waitlist state without a new row", () => {
    // Not implemented: T-REG-003 - replace this placeholder with the real steps when the task lands.
  });});
