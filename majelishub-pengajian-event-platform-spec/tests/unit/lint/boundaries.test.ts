/**
 * TEST SKELETON - lint/boundaries.test.ts
 * Layer: unit · Owning task: T-ARCH-002 · Requirement(s): NFR-OPS-001
 * Specification: ARCHITECTURE.md imports, ADR-0002
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: the module direction is a rule, not a preference; a domain file that imports the database defeats the whole layering.
 */
import { describe, test } from "vitest";

describe.todo("module boundaries", () => {
  test.todo("flags a domain module importing from features, server or app");
  test.todo("flags a domain module importing a framework or runtime package");
  test.todo("allows features importing domain and shared contracts");
  test.todo("requires an inline disable to carry a written reason");});
