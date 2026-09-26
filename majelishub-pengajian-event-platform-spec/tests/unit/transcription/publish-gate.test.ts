/**
 * TEST SKELETON - transcription/publish-gate.test.ts
 * Layer: unit · Owning task: T-TRANSCRIPT-012 · Requirement(s): FR-TRANSCRIPT-010
 * Specification: ADR-0012
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: four independent layers must each refuse; this is the service-layer one.
 */
import { describe, test } from "vitest";

describe.todo("publish gate evaluation", () => {
  test.todo("returns not-allowed with reasons when the event policy is INTERNAL");
  test.todo("returns not-allowed when blocking flags are unresolved without acknowledgement");
  test.todo("returns allowed with a reason when a blocking flag is explicitly acknowledged");
  test.todo("never returns allowed without an approval record");});
