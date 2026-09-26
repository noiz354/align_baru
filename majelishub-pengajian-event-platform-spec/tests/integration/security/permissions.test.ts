/**
 * INTEGRATION TEST SKELETON - security/permissions.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-SEC-002 · Requirement(s): FR-ORG-002, NFR-SEC-002
 * Specification: docs/security/AUTHZ-MATRIX.md, SECURITY.md §4
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the matrix is only real if every cell is executed.
 */
import { describe, test } from "vitest";

describe.todo("permission matrix", () => {
  test.todo("walks every role x permission cell and asserts the documented outcome");
  test.todo("requires a stored reason for every reason-required permission");
  test.todo("refuses self-approval (separation of duties) and self-escalation");
  test.todo("proves by static analysis that no protected action skips requirePermission");});
