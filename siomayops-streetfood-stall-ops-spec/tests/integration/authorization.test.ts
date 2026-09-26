/** TODO TESTS — Phase 0 (TESTING.md §4.8, docs/security/PERMISSIONS.md). Task: T-AUTHZ-001. */
import { describe, it } from "vitest";

describe("authorization and scope (T-AUTHZ-001)", () => {
  it.todo("denies an operator reading another operator's shift, sale or expense records");
  it.todo("denies a supervisor acting outside their area scope");
  it.todo("denies every role that lacks the specific action, not just the surface");
  it.todo("audits every denial with actor, action, subject and correlation id (FR-AUDIT-005)");
  it.todo("cannot execute an unscoped repository call (INV-11 compile-time proof)");
});
