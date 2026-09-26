/**
 * TEST SKELETON - registration/contact-hash.test.ts
 * Layer: unit · Owning task: T-REG-011 · Requirement(s): NFR-PRIV-001
 * Specification: TASKS.md T-REG-011
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: a plain digest of a phone number is a dictionary attack away from being a phone number.
 */
import { describe, test } from "vitest";

describe.todo("contact hashing", () => {
  test.todo("produces a stable keyed hash for the same normalised value and salt version");
  test.todo("produces different hashes across salt versions and supports re-hash migration");
  test.todo("normalises plausible local Indonesian number formats without rejecting them");});
