/**
 * TEST SKELETON - audio/recorder-gate.test.ts
 * Layer: unit · Owning task: T-AUDIO-002 · Requirement(s): FR-AUDIO-013
 * Specification: AUDIO.md §2, PRIVACY.md §5
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: capture without notice is unacceptable, and an INTERNAL policy must never become public.
 */
import { describe, test } from "vitest";

describe.todo("recorder policy gate", () => {
  test.todo("refuses to start a session without a recorded policy acknowledgement");
  test.todo("snapshots the policy so a later change does not alter an existing session");
  test.todo("renders no player for an INTERNAL session outside authorized roles");});
