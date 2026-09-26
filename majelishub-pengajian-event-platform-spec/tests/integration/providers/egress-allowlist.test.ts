/**
 * INTEGRATION TEST SKELETON - providers/egress-allowlist.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-TRANSCRIPT-005 · Requirement(s): NFR-PRIV-007
 * Specification: TASKS.md T-TRANSCRIPT-005
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: if audio can leave, it must leave only where we decided.
 */
import { describe, test } from "vitest";

describe.todo("provider egress allow-list", () => {
  test.todo("fails a connection to a host outside the allow-list");
  test.todo("records the active provider on every job");
  test.todo("keeps the self-hosted adapter fully offline");});
