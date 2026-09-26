/**
 * E2E SKELETON - transcription-review-publish.spec.ts
 * Layer: Playwright (composed stack) · Owning task: T-TRANSCRIPT-012 · Requirement(s): FR-TRANSCRIPT-006/010/014
 * Scenario: TESTING.md §6.3 · Specification: TESTING.md §6.3 scenario 4
 * Phase 0: each step is registered with `test.fixme(title)` - a real Playwright API that declares the
 * test without executing it - so the scenario is machine-checkable and cannot drift from the spec while
 * nothing is implemented. Fake media devices and network conditions are
 * configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: the integrity promise, exercised end to end exactly as a reviewer experiences it.
 */
import { test } from "@playwright/test";

test.describe("transcription to publication", () => {
  test.fixme("an organizer requests transcription for a ready asset");
  test.fixme("a fixture provider response (with an Arabic code-switch passage and a deliberate error) becomes a draft");
  test.fixme("the reviewer corrects the text, marks uncertainty and flags an attribution");
  test.fixme("the reviewer approves; the public page shows provenance, the revision and the uncertainty");
  test.fixme("attempting to publish without approval fails at the API and at the database");
  test.todo("a later edit does not change the public output until it is approved again");});
