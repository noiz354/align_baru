/**
 * TEST SKELETON - browser/registration/form.test.ts
 * Layer: browser · Owning task: T-REG-001 · Requirement(s): FR-REG-001
 * Specification: REGISTRATION.md §4, NFR-A11Y-002
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: registration happens on cheap phones, in a hurry, often with a screen reader.
 */
import { describe, test } from "vitest";

describe.todo("registration form", () => {
  test.todo("asks for at most four fields and marks optional ones");
  test.todo("announces validation errors without echoing the contact value");
  test.todo("is completable with keyboard only and with a screen reader");
  test.todo("shows the waitlist outcome clearly when capacity is full");});
