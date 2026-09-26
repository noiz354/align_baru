/**
 * INTEGRATION TEST SKELETON - attendance/duplicate-under-load.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-PERF-002 · Requirement(s): NFR-PERF-004
 * Specification: docs/architecture/CONCURRENCY.md
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the race is most likely exactly when the queue is longest.
 */
import { describe, test } from "vitest";
// Concurrency case: C2 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("duplicates under load", () => {
  test.todo("holds the one-row invariant at 3x the target scan rate");
  test.todo("keeps p95 latency within the entrance budget or sheds with an explicit busy result (never a false success)");});
