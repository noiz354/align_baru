/**
 * TEST SKELETON - domain/feedback/anonymity.test.ts
 * Layer: unit · Owning task: T-FEEDBACK-004 · Requirement(s): NFR-PRIV-005
 * Specification: FEEDBACK.md §4, ADR-0016
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: anonymity must be a constraint, not a promise.
 */
import { describe, test } from "vitest";

describe.todo("feedback anonymity", () => {
  test.todo("refuses to store an anonymous submission carrying a registration link or contact hash");
  test.todo("stores day-granularity time for anonymous rows");
  test.todo("types the anonymous projection so no attribution field can be read");});
