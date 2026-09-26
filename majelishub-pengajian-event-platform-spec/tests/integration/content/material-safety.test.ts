/**
 * INTEGRATION TEST SKELETON - content/material-safety.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CONTENT-003 · Requirement(s): FR-CONTENT-003
 * Specification: THREAT_MODEL T-23
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: materials are the easiest way to smuggle a payload or a tracker into the product.
 */
import { describe, test } from "vitest";

describe.todo("material safety", () => {
  test.todo("rejects a disguised file type and serves nothing for it");
  test.todo("serves accepted files with attachment disposition and nosniff");
  test.todo("renders links display-only without open-redirect behaviour");
  test.todo("blocks remote images and tracking resources");});
