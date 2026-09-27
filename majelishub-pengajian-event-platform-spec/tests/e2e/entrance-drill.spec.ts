/**
 * E2E SKELETON - entrance-drill.spec.ts
 * Layer: Playwright (composed stack) · Owning task: T-PERF-002 · Requirement(s): FR-CHECKIN-009, NFR-PERF-004
 * Scenario: TESTING.md §6.3 · Specification: TESTING.md §6.3 scenario 2, QA-01
 * Phase 0: each step is registered with `test.fixme(title, () => {})` - a real Playwright API that
 * declares the test and skips it - so the scenario is machine-checkable (`playwright test --list`) and
 * cannot drift from the spec while nothing is implemented. The body is never executed; it names the
 * owning task. `test.todo` does not exist in Playwright - do not reintroduce it. Fake media devices
 * and network conditions are configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: the entrance is the only place where failure is visible to a crowd.
 */
import { test } from "@playwright/test";

test.describe("entrance drill", () => {
  test.fixme("200 seeded registrations are checked in from three parallel contexts using QR fixture video", () => {
    // Not implemented: T-PERF-002 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("duplicate codes produce ALREADY_CHECKED_IN and never a second record", () => {
    // Not implemented: T-PERF-002 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("an invalid poster QR and a Wi-Fi QR are rejected without server traffic", () => {
    // Not implemented: T-PERF-002 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("a wrong-event code produces the specific wrong-event result", () => {
    // Not implemented: T-PERF-002 - replace this placeholder with the real steps when the task lands.
  });
  test.fixme("the attendance summary reconciles exactly against the seeded expectation", () => {
    // Not implemented: T-PERF-002 - replace this placeholder with the real steps when the task lands.
  });});
