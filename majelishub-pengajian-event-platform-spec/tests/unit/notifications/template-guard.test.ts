/**
 * TEST SKELETON - notifications/template-guard.test.ts
 * Layer: unit · Owning task: T-NOTIF-002 · Requirement(s): FR-NOTIF-010
 * Specification: NOTIFICATIONS.md §4/§6
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: a token in a forwarded email is a credential leak.
 */
import { describe, test } from "vitest";

describe.todo("template guard", () => {
  test.todo("rejects a token-shaped value in an uncontrolled template");
  test.todo("allows a token only in an access-controlled template");
  test.todo("replaces the token with a single-use redemption link in uncontrolled channels");
  test.todo("keeps reminder wording free of attendance status");});
