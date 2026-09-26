/**
 * INTEGRATION TEST SKELETON - attendance/duplicate-scan.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CHECKIN-014 · Requirement(s): FR-CHECKIN-009
 * Specification: docs/testing/CONCURRENCY-TESTS.md C2
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: two scanners, one door, one participant - the classic duplicate.
 */
import { describe, test } from "vitest";
// Concurrency case: C2 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("concurrent duplicate scans", () => {
  test.todo("with N parallel validations exactly one attendance row exists");
  test.todo("every losing call receives ALREADY_CHECKED_IN with the winner's timestamp and entrance");
  test.todo("the duplicate metric increases and no success response is duplicated");});
