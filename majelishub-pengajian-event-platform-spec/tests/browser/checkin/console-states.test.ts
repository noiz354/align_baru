/**
 * TEST SKELETON - browser/checkin/console-states.test.ts
 * Layer: browser · Owning task: T-CHECKIN-002 · Requirement(s): FR-CHECKIN-016
 * Specification: ACCESSIBILITY.md §4
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: the entrance states must be readable at a metre, in daylight, with a queue waiting.
 */
import { describe, test } from "vitest";

describe.todo("check-in console states", () => {
  test.todo("announces results in a PII-free live region");
  test.todo("shows the context bar that cannot be scrolled away");
  test.todo("presents manual entry immediately when the camera is denied");
  test.todo("never shows a success state while a result is unconfirmed");});
