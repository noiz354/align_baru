/**
 * INTEGRATION TEST SKELETON - jobs/duplicate-execution.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-ARCH-005 · Requirement(s): NFR-REL-004
 * Specification: ADR-0010, docs/architecture/FAILURE-MODEL.md §4
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: workers restart, overlap and retry - jobs must converge, not multiply.
 */
import { describe, test } from "vitest";
// Concurrency case: C11 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("duplicate job execution", () => {
  test.todo("runs one assembly effect when the job is executed twice concurrently (singleton key)");
  test.todo("marks exactly one current asset version after a retried processing job");
  test.todo("leaves a re-run retention batch idempotent");});
