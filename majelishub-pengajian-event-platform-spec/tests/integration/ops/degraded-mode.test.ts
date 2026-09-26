/**
 * INTEGRATION TEST SKELETON - ops/degraded-mode.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-OPS-004 · Requirement(s): NFR-REL-006
 * Specification: docs/architecture/FAILURE-MODEL.md §3
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: a kajian must continue even when a subsystem does not.
 */
import { describe, test } from "vitest";

describe.todo("degraded modes", () => {
  test.todo("manual-only check-in is reachable by flag and shown on the console");
  test.todo("recording-local-only keeps recording while uploads are paused");
  test.todo("no degraded mode can produce a false success");
  test.todo("entering and leaving a degraded mode is audited");});
