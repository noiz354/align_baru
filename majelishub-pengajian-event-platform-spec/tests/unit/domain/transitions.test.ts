/**
 * TEST SKELETON - domain/transitions.test.ts
 * Layer: unit · Owning task: T-ARCH-001 · Requirement(s): NFR-REL-003
 * Specification: STATE_MACHINE.md §11, TESTING.md §4.1
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: state machines carry the product's integrity rules; exhaustive pair coverage is cheap because machines are data.
 */
import { describe, test } from "vitest";

describe.todo("state machine coverage", () => {
  test.todo("every machine declares states and transitions that reference only declared states");
  test.todo("no transition targets an undeclared state");
  test.todo("terminal states have no outgoing transitions (ARCHIVED, TAKEN_DOWN, FINALIZED, CANCELLED where declared terminal)");
  test.todo("forbidden pairs are absent: event CANCELLED->anything, event ARCHIVED->anything, registration CANCELLED->REGISTERED");
  test.todo("every sideEffectId corresponds to an event in EVENTS.md or a documented non-event effect");
  test.todo("check-in results: only VALID and ALREADY_CHECKED_IN are success-shaped");});
