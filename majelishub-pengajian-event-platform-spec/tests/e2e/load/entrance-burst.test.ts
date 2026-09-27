/**
 * E2E SKELETON - load/entrance-burst.test.ts
 * Layer: Playwright (composed stack) · Owning task: T-PERF-001 · Requirement(s): NFR-PERF-004
 * Scenario: TESTING.md §6.3 · Specification: PERFORMANCE.md P11-P16
 * Phase 0: each step is registered with `test.fixme(title, async () => {})` - Playwright's declared-but-
 * not-executed form (Playwright has no `test.todo`, and `test.fixme(title)` with a single string is not
 * a valid signature) - so the scenario is machine-checkable and cannot drift from the spec while
 * nothing is implemented. Fake media devices and network conditions are
 * configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: budgets are verified, not assumed.
 */
import { test } from "@playwright/test";

test.describe("entrance burst load", () => {
  test.fixme("measures check-in p95 and p99 at the target throughput and compares them with P11/P12", async () => {});
  test.fixme("measures scan-to-confirm time for the fast and fallback scanner tiers", async () => {});
  test.fixme("measures registration contention against a fixed capacity and reports the loser outcomes", async () => {});
  test.fixme("measures upload concurrency with induced failures and reports the backlog behaviour", async () => {});
  test.fixme("records the hardware class with every run and marks a run inconclusive rather than passing", async () => {});
});
