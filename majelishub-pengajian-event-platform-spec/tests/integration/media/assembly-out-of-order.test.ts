/**
 * INTEGRATION TEST SKELETON - media/assembly-out-of-order.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-AUDIO-009 · Requirement(s): FR-AUDIO-010
 * Specification: docs/media/AUDIO-PIPELINE.md §3
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: upload order is not arrival order.
 */
import { describe, test } from "vitest";
// Concurrency case: C7 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("assembly ordering", () => {
  test.todo("assembles correctly when chunks arrive out of order");
  test.todo("produces the same master for the same chunk set regardless of arrival order");
  test.todo("reports a gap manifest instead of producing a falsely continuous file");});
