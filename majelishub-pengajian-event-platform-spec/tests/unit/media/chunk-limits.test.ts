/**
 * TEST SKELETON - media/chunk-limits.test.ts
 * Layer: unit · Owning task: T-AUDIO-004 · Requirement(s): FR-AUDIO-006
 * Specification: docs/media/CHUNK-PROTOCOL.md §3
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: caps protect storage and the entrance from a stuck client.
 */
import { describe, test } from "vitest";

describe.todo("chunk limits", () => {
  test.todo("rejects a chunk above the per-chunk cap");
  test.todo("rejects the chunk that would exceed the per-session cap");
  test.todo("accepts a chunk at exactly the cap boundary");});
