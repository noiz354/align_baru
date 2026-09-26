/**
 * TEST SKELETON - checkin/result-mapping.test.ts
 * Layer: unit · Owning task: T-CHECKIN-014 · Requirement(s): FR-CHECKIN-004
 * Specification: CHECKIN.md §5
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: a false success at the door is the worst possible failure; mapping failures to success must be impossible.
 */
import { describe, test } from "vitest";

describe.todo("check-in result mapping", () => {
  test.todo("maps every domain outcome to exactly one result kind");
  test.todo("keeps UNAVAILABLE and every failure out of the success shape");
  test.todo("returns ALREADY_CHECKED_IN with the original time and entrance");
  test.todo("includes an actionable Indonesian message and a suggested action for each kind");});
