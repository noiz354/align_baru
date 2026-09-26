/**
 * TEST SKELETON - domain/recurrence.test.ts
 * Layer: unit · Owning task: T-PROGRAM-002 · Requirement(s): FR-PROGRAM-002
 * Specification: docs/product/PROGRAMS.md §3, ADR-0018
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: recurrence errors are silent and embarrassing (a mosque tells people the wrong Sunday).
 */
import { describe, test } from "vitest";

describe.todo("recurrence engine", () => {
  test.todo("computes weekly occurrences in the venue timezone across a month boundary");
  test.todo("applies exception dates and replaces an occurrence with a special event");
  test.todo("computes prayer-relative times from a fixed prayer-time source");
  test.todo("flags a prayer-relative occurrence as perkiraan when the source is unavailable instead of guessing");
  test.todo("handles a DST locale correctly even though Indonesia has none");
  test.todo("never rewrites an already published or completed occurrence when the rule changes");});
