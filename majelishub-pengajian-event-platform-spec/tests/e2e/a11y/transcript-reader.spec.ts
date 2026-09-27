/**
 * E2E SKELETON - a11y/transcript-reader.spec.ts
 * Layer: Playwright (composed stack) · Owning task: T-CONTENT-007 · Requirement(s): NFR-A11Y-004, NFR-I18N-001
 * Scenario: TESTING.md §6.3 · Specification: ACCESSIBILITY.md §5
 * Phase 0: each step is registered with `test.fixme(title, async () => {})` - Playwright's declared-but-
 * not-executed form (Playwright has no `test.todo`, and `test.fixme(title)` with a single string is not
 * a valid signature) - so the scenario is machine-checkable and cannot drift from the spec while
 * nothing is implemented. Fake media devices and network conditions are
 * configured in playwright.config.ts (T-TEST-001).
 * Why this scenario: a published transcript is read, not scanned; readers should not depend on mouse precision.
 */
import { test } from "@playwright/test";

test.describe("transcript accessibility", () => {
  test.fixme("Arabic spans are announced in Arabic and rendered RTL without clipping", async () => {});
  test.fixme("timestamp navigation is reachable by keyboard with visible focus", async () => {});
  test.fixme("large-text mode keeps diacritics and the provenance block readable", async () => {});
  test.fixme("copy-paste preserves characters and direction", async () => {});
});
