/**
 * TEST SKELETON - lint/console-ban.test.ts
 * Layer: unit · Owning task: T-OBS-002 · Requirement(s): NFR-OBS-002
 * Specification: OBSERVABILITY.md §5
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: one logging interface keeps the privacy allow-list enforceable.
 */
import { describe, test } from "vitest";

describe.todo("console ban", () => {
  test.todo("flags console.* outside src/server/bootstrap/**");
  test.todo("allows console output inside the bootstrap module");});
