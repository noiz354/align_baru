/**
 * Fake ports for unit tests (see README.md for the table and the rules).
 *
 * Where this belongs: tests/support - unit-layer doubles only. Integration tests use REAL Postgres and
 * MinIO; a unit test may never be used to prove a database constraint (TESTING.md §2).
 * Phase 0: the fakes are not implemented. `fakes()` throws so that a test which accidentally depends on
 * one fails loudly instead of silently passing against an empty object.
 * Task ownership: T-TEST-001 (harness), T-TEST-002 (fixtures and seeds).
 */
export interface Fakes {
  readonly clock: unknown;
  readonly tokenService: unknown;
  readonly queue: unknown;
  readonly storage: unknown;
  readonly transcriptionProvider: unknown;
}

/** @throws Error("Not implemented: T-TEST-001") */
export function fakes(): Fakes {
  throw new Error("Not implemented: T-TEST-001");
}
