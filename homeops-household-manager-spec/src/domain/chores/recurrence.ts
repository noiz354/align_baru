// HomeOps - domain skeleton (specification phase). Pure date math only (no I/O, no clock read).

import type { LocalDate } from '../../shared/types';
import type { RecurrenceRule } from './types';

/**
 * Compute the next occurrence date for calendar-anchored rules.

 * Invariants the implementation must hold (docs/product/RECURRENCE.md):
 *  - the result derives from the rule own anchor and the *previous slot*, never from `now`;
 *    a scheduler that runs late must still produce the correct date (I-CHORE-004);
 *  - month/day clamping follows src/shared/time/clamping (an "on the 31st" rule stays on the 31st);
 *  - DST never shifts an all-day date, and the household timezone governs "today" (I-XA-006);
 *  - WEEKDAYS with an empty set is invalid (RECURRENCE_RULE_INVALID);
 *  - intervals are bounded: 1-365 days, 1-52 weeks, 1-24 months.

 * Test suite: tests/unit/domain/chores/recurrence.test.ts (rule tables, late ticks, clamping).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-021 - requirements, ADR, design, and tests are listed there.
 */
export function calculateNextOccurrence(_input: {
  readonly rule: RecurrenceRule;
  readonly previousSlot: LocalDate;
  readonly householdTimezone: string;
}): LocalDate | null {
  throw new Error('Not implemented: T-CHORE-021');
}

/**
 * Compute the next date for AFTER_COMPLETION rules: last completion + interval.
 * A skip must NOT advance the series (I-CHORE-005); a reopen restores the previous anchor;
 * a never-completed definition falls back to its creation anchor.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-022 - requirements, ADR, design, and tests are listed there.
 */
export function calculateNextAfterCompletion(_input: {
  readonly intervalDays: number;
  readonly lastCompletedAtInstant: string | null;
  readonly fallbackAnchor: LocalDate;
  readonly householdTimezone: string;
}): LocalDate {
  throw new Error('Not implemented: T-CHORE-022');
}

/**
 * Render a rule as a sentence a person would say, for example
 *   EVERY_N_WEEKS { interval: 2, weekday: Fri } -> "Every 2 weeks on Friday"
 *   AFTER_COMPLETION { intervalDays: 7 }        -> "7 days after it is done"
 * Singular/plural is handled ("Every 1 day" must read "Every day"); the caller appends the
 * concrete next date so nobody has to parse a rule in their head (DESIGN.md section 17, T-4).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-026 - requirements, ADR, design, and tests are listed there.
 */
export function describeRecurrence(_rule: RecurrenceRule): string {
  throw new Error('Not implemented: T-CHORE-026');
}

/**
 * Validate a rule structurally and semantically (interval bounds, weekday set, day-of-month
 * range). Returns a value rather than throwing: invalid input is an expected outcome
 * (docs/api/CONVENTIONS.md section 2).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-CHORE-021 - requirements, ADR, design, and tests are listed there.
 */
export function validateRecurrenceRule(
  _rule: RecurrenceRule,
): { readonly ok: true } | { readonly ok: false; readonly code: 'RECURRENCE_RULE_INVALID' | 'RECURRENCE_INTERVAL_INVALID' } {
  throw new Error('Not implemented: T-CHORE-021');
}
