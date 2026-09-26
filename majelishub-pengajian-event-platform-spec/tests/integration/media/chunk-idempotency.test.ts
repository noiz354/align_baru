/**
 * INTEGRATION TEST SKELETON - media/chunk-idempotency.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-AUDIO-004 · Requirement(s): FR-AUDIO-005
 * Specification: docs/media/CHUNK-PROTOCOL.md §3
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: a retry storm on a bad network is the normal case, not the exception.
 */
import { describe, test } from "vitest";
// Concurrency case: C8 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("chunk idempotency", () => {
  test.todo("accepts the same (sequence, hash) twice as one stored object with duplicate=true");
  test.todo("returns CHUNK_SEQUENCE_CONFLICT for the same sequence with a different hash");
  test.todo("never overwrites stored audio bytes");
  test.todo("writes the row only after the object exists (success means durable)");});
