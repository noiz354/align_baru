/**
 * INTEGRATION TEST SKELETON - audit/coverage.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-SEC-007 · Requirement(s): FR-AUDIT-002
 * Specification: docs/security/AUTHZ-MATRIX.md
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: reason-required actions are exactly the ones that must be explainable later.
 */
import { describe, test } from "vitest";

describe.todo("audit coverage", () => {
  test.todo("writes an entry for every reason-required permission");
  test.todo("records actor, scope, target and reason without content");
  test.todo("fails closed when an audit write fails for a security-relevant action");});
