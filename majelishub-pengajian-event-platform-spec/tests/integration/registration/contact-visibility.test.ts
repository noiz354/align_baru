/**
 * INTEGRATION TEST SKELETON - registration/contact-visibility.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-REG-011 · Requirement(s): NFR-PRIV-001
 * Specification: PRIVACY.md §4, THREAT_MODEL T-07
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the participant list is the most attractive target in the system.
 */
import { describe, test } from "vitest";

describe.todo("contact visibility", () => {
  test.todo("returns the minimised projection for every role that can list registrations");
  test.todo("refuses contact fields without the narrow permission and records an audit entry when granted");
  test.todo("never returns contacts through any list or export endpoint");});
