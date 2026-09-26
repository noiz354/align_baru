/**
 * INTEGRATION TEST SKELETON - security/rate-limits.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-SEC-010 · Requirement(s): NFR-SEC-010
 * Specification: SECURITY.md §8, TASKS.md T-PERF-002
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: limits must be shared across replicas and must not punish a mosque's shared connection.
 */
import { describe, test } from "vitest";

describe.todo("rate limits", () => {
  test.todo("enforces the documented thresholds on every attempt path");
  test.todo("shares counters across replicas (durable store, not in-memory)");
  test.todo("does not throttle the target scan rate (>= 200/min/event) under normal load");
  test.todo("returns RATE_LIMITED with retry guidance and never a false success");});
