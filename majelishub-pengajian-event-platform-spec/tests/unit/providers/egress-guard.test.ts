/**
 * TEST SKELETON - providers/egress-guard.test.ts
 * Layer: unit · Owning task: T-TRANSCRIPT-005 · Requirement(s): NFR-PRIV-007
 * Specification: TASKS.md T-TRANSCRIPT-005, PRIVACY.md §5
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: no audio may leave the deployment because of a default.
 */
import { describe, test } from "vitest";

describe.todo("provider egress guard", () => {
  test.todo("throws when constructing a hosted adapter while egress is disabled");
  test.todo("constructs the self-hosted adapter without egress");
  test.todo("reports the processor table and enabled adapters as consistent at boot");});
