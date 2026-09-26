/**
 * TEST SKELETON - browser/audio/recorder-states.test.ts
 * Layer: browser · Owning task: T-AUDIO-001 · Requirement(s): FR-AUDIO-003
 * Specification: docs/media/CHUNK-PROTOCOL.md §4
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: the operator must be able to tell healthy recording from a gap at a glance.
 */
import { describe, test } from "vitest";

describe.todo("recorder states", () => {
  test.todo("shows elapsed time and level meter while recording");
  test.todo("shows an explicit gap warning without stopping the session");
  test.todo("shows an explicit backlog indicator instead of a success tick");
  test.todo("requires a one-tap re-auth after an idle timeout without losing the local queue");});
