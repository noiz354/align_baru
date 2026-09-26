/**
 * INTEGRATION TEST SKELETON - security/tokens.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CHECKIN-003 · Requirement(s): NFR-SEC-005
 * Specification: docs/security/QR-SECURITY.md §2/§6
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: token storage and payload properties are the difference between a credential and a leak.
 */
import { describe, test } from "vitest";

describe.todo("token security", () => {
  test.todo("stores no plaintext token column (schema assertion)");
  test.todo("keeps the payload free of PII, entity UUIDs and URL parameters");
  test.todo("produces distinct outcomes for wrong-event, expired, revoked and cancelled");
  test.todo("never echoes the submitted token in a response or an error");});
