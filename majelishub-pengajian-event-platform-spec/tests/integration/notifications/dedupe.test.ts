/**
 * INTEGRATION TEST SKELETON - notifications/dedupe.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-NOTIF-006 · Requirement(s): FR-NOTIF-009
 * Specification: ADR-0015, NOTIFICATIONS.md
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: duplicate messages are how a warning system becomes noise people ignore.
 */
import { describe, test } from "vitest";
// Concurrency case: C10 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("notification dedupe", () => {
  test.todo("delivers exactly one message per dedupe_key");
  test.todo("records a second intent with the same key as suppressed");
  test.todo("keeps distinct facts with distinct keys as separate messages");});
