/**
 * INTEGRATION TEST SKELETON - analytics/duplicate-rate.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CHECKIN-018 · Requirement(s): FR-ANALYTICS-002
 * Specification: THREAT_MODEL T-03
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the duplicate signal must help organizers without creating a list of suspicious people.
 */
import { describe, test } from "vitest";

describe.todo("duplicate-rate analytics", () => {
  test.todo("reports duplicates as an aggregate rate per event and per device");
  test.todo("exposes no per-participant duplicate field anywhere");
  test.todo("shows the rate as a question with guidance, never as a verdict about a person");});
