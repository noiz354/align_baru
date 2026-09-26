/**
 * INTEGRATION TEST SKELETON - security/session-scope.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CHECKIN-016 · Requirement(s): NFR-SEC-001
 * Specification: SECURITY.md §7, THREAT_MODEL T-12
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: a borrowed volunteer phone must not be able to do anything else.
 */
import { describe, test } from "vitest";

describe.todo("bound session scope", () => {
  test.todo("refuses every non-check-in action from a check-in session");
  test.todo("ends the session on idle timeout and requires re-authentication");
  test.todo("invalidates the device immediately on revocation");
  test.todo("records the device and entrance on every check-in it performs");});
