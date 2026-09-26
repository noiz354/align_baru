/**
 * INTEGRATION TEST SKELETON - registration/contact-withdrawal.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-REG-011 · Requirement(s): NFR-PRIV-002
 * Specification: PRIVACY.md §4, RETENTION.md
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: withdrawal must work without destroying the attendance record.
 */
import { describe, test } from "vitest";

describe.todo("contact withdrawal", () => {
  test.todo("removes the contact value while keeping the registration and attendance intact");
  test.todo("causes a queued notification to be skipped rather than sent");
  test.todo("is idempotent and audited");});
