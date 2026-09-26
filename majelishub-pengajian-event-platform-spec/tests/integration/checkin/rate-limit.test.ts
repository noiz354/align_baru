/**
 * INTEGRATION TEST SKELETON - checkin/rate-limit.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-PERF-002 · Requirement(s): NFR-PERF-004
 * Specification: PERFORMANCE.md P11-P16
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: throttling the entrance is indistinguishable from an outage to the people queueing.
 */
import { describe, test } from "vitest";

describe.todo("check-in rate limits", () => {
  test.todo("allows the documented target throughput per device and per event");
  test.todo("sheds excess load with an explicit busy result");
  test.todo("keeps the manual path usable regardless of load");
  test.todo("never converts a rejection into a success or a silent drop");});
