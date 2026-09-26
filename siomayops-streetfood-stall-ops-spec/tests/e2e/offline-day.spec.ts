/**
 * TODO E2E — Phase 0 (TESTING.md §3, AC-02). Task: T-OFF-001.
 * The flow that must exist after implementation: one full offline day, synced with zero duplicates
 * and zero losses — start shift, 20+ sales, 3 expenses, stock count, closing, reconnect, verify.
 */
import { test } from "@playwright/test";

test.describe("offline day (to be implemented)", () => {
  test.fixme("records a full offline day and syncs it without duplicates or losses", async () => {});
  test.fixme("never shows a digital payment as successful while offline", async () => {});
  test.fixme("keeps cash selling possible with no network for the whole shift", async () => {});
});
