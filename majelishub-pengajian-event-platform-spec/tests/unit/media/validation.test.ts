/**
 * TEST SKELETON - media/validation.test.ts
 * Layer: unit · Owning task: T-SEC-005 · Requirement(s): NFR-SEC-009
 * Specification: docs/media/STORAGE.md, THREAT_MODEL T-10
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: an extension is not evidence of content type.
 */
import { describe, test } from "vitest";

describe.todo("upload validation", () => {
  test.todo("rejects a zip renamed .webm by magic bytes");
  test.todo("rejects truncated and oversized payloads with distinct codes");
  test.todo("accepts the fixture WebM/Ogg speech files");
  test.todo("leaves no object behind and enqueues no job on rejection");});
