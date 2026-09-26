/**
 * INTEGRATION TEST SKELETON - attendance/correction-race.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-ATTEND-004 · Requirement(s): FR-ATTEND-007
 * Specification: ATTENDANCE.md corrections
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: corrections are where a careless system rewrites history.
 */
import { describe, test } from "vitest";
// Concurrency case: C5 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("concurrent corrections", () => {
  test.todo("serialises two concurrent corrections so the second sees the first (row lock)");
  test.todo("keeps both corrections as append-only rows with their own reasons");
  test.todo("refuses a correction without a reason of at least 8 characters");});
