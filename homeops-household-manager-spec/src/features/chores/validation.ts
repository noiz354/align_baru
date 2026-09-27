// HomeOps - feature skeleton (specification phase). Contract only.

import type { RecurrenceRule } from '../../domain/chores/types';

/**
 * Turning the recurrence builder (title + a human choice) into a RecurrenceRule, and back again.
 * Kept in the feature layer because it is a UI translation concern: the domain receives a validated
 * rule, never raw form fields. Implementation: T-CHORE-025 / T-CHORE-026.
 */
export type RecurrenceBuilderState =
  | { readonly preset: 'ONE_OFF' }
  | { readonly preset: 'DAILY' }
  | { readonly preset: 'WEEKDAYS'; readonly weekdays: readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[] }
  | {
      readonly preset: 'EVERY_N_WEEKS';
      readonly interval: number;
      readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    }
  | { readonly preset: 'EVERY_N_DAYS'; readonly interval: number }
  | { readonly preset: 'MONTHLY'; readonly dayOfMonth: number }
  | { readonly preset: 'AFTER_COMPLETION'; readonly intervalDays: number };

/** Must produce a rule that validateRecurrenceRule accepts, or a field-level error for the form. */
export function toRecurrenceRule(
  _state: RecurrenceBuilderState,
): RecurrenceRule | { readonly error: string } {
  throw new Error('Not implemented: T-CHORE-025');
}
