/**
 * TEST SKELETON - observability/token-logging.test.ts
 * Layer: unit · Owning task: T-SEC-004 · Requirement(s): NFR-PRIV-006
 * Specification: ADR-0006 enforcement, TASKS.md T-SEC-004
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: tokens and codes are credentials; logging them is an incident.
 */
import { describe, test } from "vitest";

describe.todo("token logging ban", () => {
  test.todo("flags a logging call referencing a token or code field");
  test.todo("strips token-named attributes at runtime");
  test.todo("omits token fields from serialised errors");
  test.todo("shares one ban list between the lint rule and the runtime guard");});
