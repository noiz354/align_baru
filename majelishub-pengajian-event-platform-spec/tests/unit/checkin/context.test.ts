/**
 * TEST SKELETON - checkin/context.test.ts
 * Layer: unit · Owning task: T-CHECKIN-006 · Requirement(s): FR-CHECKIN-002
 * Specification: CHECKIN.md §2/§7
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: checking people into the wrong event is the most likely operational mistake.
 */
import { describe, test } from "vitest";

describe.todo("check-in context", () => {
  test.todo("cannot widen the bound context from the client");
  test.todo("invalidates the scan cache when the operator switches source event");
  test.todo("names the other event on a wrong-event scan without exposing any person");});
