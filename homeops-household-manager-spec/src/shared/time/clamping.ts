// HomeOps — skeleton (specification phase). Contracts only.
// Every function below is intentionally unimplemented. See AGENTS.md §1 and TASKS.md.

import type { LocalDate } from '../types';

/**
 * Month/year clamping used by both chore recurrence and maintenance frequency
 * (ADR-007, I-MNT-005). The rule that prevents silent drift:
 *
 *   the *rule* keeps its intended day (e.g. the 31st); individual occurrences
 *   clamp to the length of their month. Clamping never becomes the new anchor.
 *
 * Implemented in T-CHORE-024.
 */

/** Clamp a day-of-month into the given year/month (2026-02, 31) => 28. */
export function clampToMonth(year: number, month1to12: number, day: number): LocalDate {
  throw new Error('Not implemented: T-CHORE-024');
}

/** True when `date` is the last day of its month (used to detect clamped occurrences). */
export function isClamped(date: LocalDate): boolean {
  throw new Error('Not implemented: T-CHORE-024');
}
