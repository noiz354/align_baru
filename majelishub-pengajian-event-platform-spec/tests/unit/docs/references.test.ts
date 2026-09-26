/**
 * TEST SKELETON - docs/references.test.ts
 * Layer: unit · Owning task: T-DOCS-001 · Requirement(s): NFR-OPS-001
 * Specification: TASKS.md T-DOCS-001, AGENTS.md §11
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: documentation is authoritative: a dangling reference or a doc that is not in the ADR index makes every later reader wrong.
 */
import { describe, test } from "vitest";

describe.todo("docs lint", () => {
  test.todo("reports a file in docs/adr/ that is missing from the ADR.md index");
  test.todo("reports a requirement ID referenced anywhere but not defined in PRD.md");
  test.todo("reports a cited docs/** path that does not exist");
  test.todo("reports a task ID referenced anywhere but not defined in TASKS.md");
  test.todo("reports an empty document (no headings)");
  test.todo("passes on the current repository with zero findings");});
