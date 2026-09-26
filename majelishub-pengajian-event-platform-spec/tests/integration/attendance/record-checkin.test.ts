/**
 * INTEGRATION TEST SKELETON - attendance/record-checkin.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CHECKIN-014 · Requirement(s): FR-CHECKIN-004/009
 * Specification: CHECKIN.md §5, ATTENDANCE.md §2, ADR-0025
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: this is the write that must never happen twice and must never pretend to have happened.
 */
import { describe, test } from "vitest";
// Concurrency case: C2 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("record check-in", () => {
  test.todo("inserts exactly one attendance row with the QR method, server time and operator");
  test.todo("returns ALREADY_CHECKED_IN with the original time without creating a second row");
  test.todo("refuses a cancelled registration and creates no row");
  test.todo("refuses a closed window with the specific window outcome");
  test.todo("returns UNAVAILABLE and no row when the database write fails");
  test.todo("emits ParticipantCheckedIn in the same transaction as the insert");});
