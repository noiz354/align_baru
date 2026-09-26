/**
 * INTEGRATION TEST SKELETON - observability/tracing.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-OBS-002 · Requirement(s): NFR-OBS-001
 * Specification: OBSERVABILITY.md §6
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: a job that cannot be traced to its request is undiagnosable from a volunteer's report.
 */
import { describe, test } from "vitest";

describe.todo("tracing propagation", () => {
  test.todo("creates spans for checkin.validate, checkin.commit and recording.chunk.upload");
  test.todo("propagates trace context into the job payload that follows");
  test.todo("keeps span attributes inside the allow-list (no content, no tokens)");
  test.todo("samples 100% of check-in spans during event hours");});
