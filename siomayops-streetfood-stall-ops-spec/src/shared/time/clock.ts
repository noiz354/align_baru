/**
 * PHASE 0 — SKELETON ONLY. No business logic, no I/O, no calculations.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX`.
 * See ADR-0036 (skeleton policy) and AGENTS.md.
 */

/** Injectable clock. Domain code must never call `new Date()` directly (ADR-0033). */
export interface Clock {
  now(): Date;
}

/** Throws. Task: T-FOUND-006. The real clock is introduced with the money/time primitives. */
export const systemClock: Clock = {
  now() {
    throw new Error("Not implemented: T-FOUND-006");
  }
};

/** Fixed clock for tests/demos. Construction only — no time logic. */
export function fixedClock(instant: Date): Clock {
  return { now: () => instant };
}
