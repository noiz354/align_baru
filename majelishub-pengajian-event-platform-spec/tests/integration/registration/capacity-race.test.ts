/**
 * INTEGRATION TEST SKELETON - registration/capacity-race.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-REG-002 · Requirement(s): FR-REG-003
 * Specification: REGISTRATION.md §3, ADR-0025
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: over-capacity or a lost seat both destroy trust in the product.
 */
import { describe, test } from "vitest";
// Concurrency case: C1 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("capacity race", () => {
  test.todo("with 50 parallel submissions for the last seat exactly one is REGISTERED");
  test.todo("the losers are WAITLISTED (or refused with a reason) and never silently dropped");
  test.todo("capacity is never exceeded even when the check is bypassed at the service layer");});
