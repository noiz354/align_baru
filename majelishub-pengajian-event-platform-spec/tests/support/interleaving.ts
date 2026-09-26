/**
 * Deterministic interleaving helpers for concurrency tests (C1...C12).
 *
 * Where this belongs: tests/support. Races must be *caused*, not hoped for: `sleep()`-based races are
 * flaky and train people to ignore failures (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 *
 * Provided primitives (conceptual):
 *   gate()             - a promise the test releases explicitly, so two operations reach a chosen point
 *   advisoryLock(name) - coordinate two transactions on the same key
 *   phase(name, fn)    - run a step and assert the other operation has reached its own phase
 *
 * Assertions are always about invariants (row counts, returned outcomes, the loser's result) - never
 * about timing.
 * Task ownership: T-TEST-003.
 */
export interface Interleaving {
  gate(): { readonly wait: Promise<void>; readonly open: () => void };
  advisoryLock(name: string): Promise<() => Promise<void>>;
}

/** @throws Error("Not implemented: T-TEST-003") */
export function interleaving(): Interleaving {
  throw new Error("Not implemented: T-TEST-003");
}
