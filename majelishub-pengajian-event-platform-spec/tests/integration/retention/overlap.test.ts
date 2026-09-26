/**
 * INTEGRATION TEST SKELETON - retention/overlap.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-PRIV-003 · Requirement(s): NFR-PRIV-002
 * Specification: RETENTION.md, RUNBOOK RB-12
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: deletion racing a user action must resolve predictably.
 */
import { describe, test } from "vitest";
// Concurrency case: C12 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("retention overlap", () => {
  test.todo("either the user action completes and retention skips the row, or the row is deleted and the action fails with NOT_FOUND");
  test.todo("never leaves a partially deleted aggregate");
  test.todo("records an evidence row with counts only");});
