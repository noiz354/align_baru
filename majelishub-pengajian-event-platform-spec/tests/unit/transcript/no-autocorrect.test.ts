/**
 * TEST SKELETON - transcript/no-autocorrect.test.ts
 * Layer: unit · Owning task: T-TRANSCRIPT-014 · Requirement(s): NFR-ETH-002
 * Specification: docs/transcription/CODE-SWITCHING.md §4
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: silently 'fixing' a verse or an Arabic phrase is the one failure this product must never have.
 */
import { describe, test } from "vitest";

describe.todo("no automatic correction", () => {
  test.todo("refuses any machine-authored write to a stored segment");
  test.todo("never substitutes a canonical verse text for unclear audio");
  test.todo("never translates a segment");
  test.todo("treats a hint as a suggestion that a human must explicitly accept");});
