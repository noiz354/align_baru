/**
 * TEST SKELETON - lint/no-fake.test.ts
 * Layer: unit · Owning task: T-ARCH-003 · Requirement(s): NFR-OPS-001
 * Specification: AGENTS.md §4.1/§5, DESIGN.md phase rule
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: a skeleton must never be mistakable for working code; `return { success: true }` is forbidden.
 */
import { describe, test } from "vitest";

describe.todo("no fake implementations", () => {
  test.todo("flags a constant success-shaped return in src/**");
  test.todo("flags a stub whose Not implemented task ID does not exist in TASKS.md");
  test.todo("flags a todo test whose title states no behaviour");
  test.todo("does not flag a legitimate pure helper that returns a computed value");});
