/**
 * INTEGRATION TEST SKELETON - checkin/device-binding.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CHECKIN-016 · Requirement(s): FR-CHECKIN-014
 * Specification: SECURITY.md §7
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: devices are the weakest link at the entrance.
 */
import { describe, test } from "vitest";

describe.todo("device binding", () => {
  test.todo("binds a device to one event and one entrance with an audited action");
  test.todo("expires the session on the configured idle timeout");
  test.todo("takes effect on the next request after revocation");
  test.todo("records a device switch as a metric and an audit entry");});
