/**
 * INTEGRATION TEST SKELETON - checkin/validation.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CHECKIN-001 · Requirement(s): FR-CHECKIN-003/005
 * Specification: CHECKIN.md §3
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the outcome vocabulary is the volunteer's only guide under pressure.
 */
import { describe, test } from "vitest";

describe.todo("check-in validation", () => {
  test.todo("returns VALID for an active token inside the window");
  test.todo("returns WRONG_EVENT for a token of another event at the same mosque");
  test.todo("returns EXPIRED, REVOKED and CANCELLED for the seeded cases");
  test.todo("returns WINDOW_NOT_OPEN and WINDOW_CLOSED distinctly");
  test.todo("never writes an attendance row (validation is side-effect free)");});
