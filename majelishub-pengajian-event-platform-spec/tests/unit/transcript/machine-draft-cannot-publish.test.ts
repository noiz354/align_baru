/**
 * TEST SKELETON - transcript/machine-draft-cannot-publish.test.ts
 * Layer: unit · Owning task: T-TRANSCRIPT-012 · Requirement(s): FR-TRANSCRIPT-006
 * Specification: ADR-0012
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: the gate must exist in the domain before it exists in the database.
 */
import { describe, test } from "vitest";

describe.todo("publication gate (domain)", () => {
  test.todo("refuses publication of a machine draft (revision #1)");
  test.todo("refuses publication when the approved revision differs from the published revision");
  test.todo("refuses publication with unresolved blocking flags unless each is acknowledged with a reason");
  test.todo("allows publication only with a named approver and an approving revision");});
