/**
 * E2E SKELETON - waitlist-flow.spec.ts
 * Layer: Playwright (composed stack) · Owning task: T-REG-003 · Requirement(s): FR-REG-005/006
 * Scenario: TESTING.md §6.3 · Specification: TESTING.md §6.3 scenario 6
 * Phase 0: each step is registered with `test.fixme(title, async () => {})` - Playwright's declared-but-
 * not-executed form (Playwright has no `test.todo`, and `test.fixme(title)` with a single string is not
 * a valid signature) - so the scenario is machine-checkable and cannot drift from the spec while
 * nothing is implemented. Fake media devices and network conditions are
 * configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: capacity pressure is normal for popular kajian; the waitlist must feel fair and be honest.
 */
import { test } from "@playwright/test";

test.describe("waitlist flow", () => {
  test.fixme("a full event offers the waitlist with a clear explanation instead of a failure", async () => {});
  test.fixme("a cancellation creates an offer for the next waitlisted participant with an expiry", async () => {});
  test.fixme("accepting the offer reuses the same registration and code", async () => {});
  test.fixme("an expired offer returns the participant to the waitlist state without a new row", async () => {});
});
