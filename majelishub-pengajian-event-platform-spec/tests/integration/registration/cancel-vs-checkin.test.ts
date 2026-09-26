/**
 * INTEGRATION TEST SKELETON - registration/cancel-vs-checkin.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-REG-006 · Requirement(s): FR-REG-009
 * Specification: docs/architecture/CONCURRENCY.md
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: cancel and check-in racing is the moment a record can become incoherent.
 */
import { describe, test } from "vitest";
// Concurrency case: C3 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("cancel versus check-in", () => {
  test.todo("either the cancellation wins and the check-in is refused, or the check-in wins and the cancellation is refused");
  test.todo("never both, and never a cancelled registration with an attendance row");});
