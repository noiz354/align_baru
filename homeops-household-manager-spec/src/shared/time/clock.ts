// HomeOps — skeleton (specification phase). Contracts only.
// Every function below is intentionally unimplemented. See AGENTS.md §1 and TASKS.md.

import type { Instant } from '../types';

/**
 * The only way time enters the system (I-XA-005).
 *
 * No file under src/domain or src/features may call `new Date()` directly:
 * recurrence, quiet hours, lead times, and DST correctness all depend on an
 * injectable clock. Implementation created in T-TIME-001.
 */
export type Clock = {
  /** Current instant. In production: the system clock. In tests: a fixed or settable value. */
  now(): Instant;
};

/**
 * Household-local day boundary helpers. All "today" semantics flow through here
 * (I-XA-006, I-HH-004). Implementation created in T-TIME-003.
 */
export type HouseholdDay = {
  /** The household's current local date, e.g. '2026-10-04'. */
  today(): import('../types').LocalDate;
  /** Bounds of the household's local day containing `instant`, as UTC instants. */
  dayBounds(instant: Instant): { readonly startUtc: Instant; readonly endUtc: Instant };
  /** Add a whole number of household days, preserving the wall-clock meaning. */
  addDays(date: import('../types').LocalDate, days: number): import('../types').LocalDate;
};

export function createClock(): Clock {
  // System clock with an injectable seam. Implemented in T-TIME-001.
  throw new Error('Not implemented: T-TIME-001');
}

export function createHouseholdDay(clock: Clock, timezone: string): HouseholdDay {
  // DST-aware local-day math; the household timezone is data, not configuration (ADR-007).
  throw new Error('Not implemented: T-TIME-003');
}
