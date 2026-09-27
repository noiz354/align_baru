/**
 * E2E SKELETON - recording-survival.spec.ts
 * Layer: Playwright (composed stack) · Owning task: T-AUDIO-005 · Requirement(s): FR-AUDIO-008, NFR-REL-002
 * Scenario: TESTING.md §6.3 · Specification: TESTING.md §6.3 scenario 3, QA-02
 * Phase 0: each step is registered with `test.fixme(title, async () => {})` - Playwright's declared-but-
 * not-executed form (Playwright has no `test.todo`, and `test.fixme(title)` with a single string is not
 * a valid signature) - so the scenario is machine-checkable and cannot drift from the spec while
 * nothing is implemented. Fake media devices and network conditions are
 * configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: a two-hour recording must survive a reload, an outage and a server restart.
 */
import { test } from "@playwright/test";

test.describe("recording survival", () => {
  test.fixme("a compressed-interval session survives a reload at ~30% with no lost acknowledged chunks", async () => {});
  test.fixme("a 60-second network outage produces a visible backlog indicator and no success tick", async () => {});
  test.fixme("after reconnection the backlog drains and the sequence set is contiguous", async () => {});
  test.fixme("a worker restart during assembly converges to exactly one current asset", async () => {});
  test.fixme("the completed asset is seekable across the full timeline", async () => {});
});
