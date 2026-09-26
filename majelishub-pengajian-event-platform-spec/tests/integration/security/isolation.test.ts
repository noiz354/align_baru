/**
 * INTEGRATION TEST SKELETON - security/isolation.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-SEC-001 · Requirement(s): FR-ORG-003, NFR-SEC-003
 * Specification: ADR-0017, SECURITY.md §5
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: seeing another community's participants would end the product's credibility.
 */
import { describe, test } from "vitest";
// Concurrency case: tenant boundary (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("tenant isolation", () => {
  test.todo("returns 404 (not 403) for every cross-organization id, slug and list query");
  test.todo("returns zero rows for a cross-organization list request");
  test.todo("proves the second layer: an unscoped query is refused by row-level security");
  test.todo("logs an authorization event without object content");
  test.todo("cannot express an unscoped repository call (type-level check)");});
