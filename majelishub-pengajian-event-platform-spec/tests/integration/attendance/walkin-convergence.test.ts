/**
 * INTEGRATION TEST SKELETON - attendance/walkin-convergence.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CHECKIN-008 · Requirement(s): FR-CHECKIN-012
 * Specification: CHECKIN.md walk-in
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: two volunteers registering the same person at two doors is routine.
 */
import { describe, test } from "vitest";
// Concurrency case: C4 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("walk-in convergence", () => {
  test.todo("converges two simultaneous walk-ins with the same walkInRef into one record");
  test.todo("converges a walk-in that matches an existing registration's contact hash");
  test.todo("records the second attempt as a duplicate rather than a new arrival");});
