// HomeOps — month/year clamping (T-TIME-002, exercised by recurrence in T-CHORE-024, ADR-007).
//
// The rule that prevents silent drift: the *rule* keeps its intended day (e.g. the 31st);
// individual occurrences clamp to the length of their month. Clamping never becomes the new anchor
// (docs/product/RECURRENCE.md#month-clamping, I-CHORE-004).

import type { LocalDate } from '../types';
import { isLastDayOfMonth, parseLocalDate } from './civil-date';

// The clamp itself is a calendar primitive and lives in `civil-date.ts` so that month arithmetic
// there never imports this policy module (acyclic graph, tests/unit/architecture.test.ts). The
// re-export keeps the name recurrence callers use (T-CHORE-024).
export { clampDayToMonth as clampToMonth } from './civil-date';

/**
 * True when `date` is the last day of its month. Recurrence uses this to recognise an occurrence
 * that was clamped (31 Jan → 28 Feb) so the *next* occurrence can return to the intended day
 * instead of drifting to the 28th forever.
 */
export function isClamped(date: LocalDate): boolean {
  const parts = parseLocalDate(date);
  if (!parts) return false;
  return isLastDayOfMonth(date) && parts.day < 31;
}
