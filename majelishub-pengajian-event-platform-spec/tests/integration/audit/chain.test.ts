/**
 * INTEGRATION TEST SKELETON - audit/chain.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-SEC-007 · Requirement(s): FR-AUDIT-001
 * Specification: SECURITY.md §9, THREAT_MODEL T-17
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: an audit trail that can be edited is not evidence.
 */
import { describe, test } from "vitest";
// Concurrency case: audit append (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("audit chain", () => {
  test.todo("verifies a chain in linear time and reports the first broken index");
  test.todo("detects a row edited directly in the database");
  test.todo("appends without forking under concurrent writes");
  test.todo("refuses an UPDATE or DELETE attempt from the application role");});
