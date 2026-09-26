/**
 * TEST SKELETON - domain/feedback/aggregate.test.ts
 * Layer: unit · Owning task: T-FEEDBACK-003 · Requirement(s): FR-FEEDBACK-007
 * Specification: FEEDBACK.md §5, ADR-0016
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: suppression and denominators are what keep a small mosque's feedback from being both misleading and harmful.
 */
import { describe, test } from "vitest";

describe.todo("feedback aggregation", () => {
  test.todo("suppresses dimension output below 5 responses and reports the reason");
  test.todo("reports every rate with its denominator");
  test.todo("produces no ordering that would rank speakers, mosques or events");
  test.todo("recomputes the same aggregate from the same raw rows (recomputable, as-of stamped)");});
