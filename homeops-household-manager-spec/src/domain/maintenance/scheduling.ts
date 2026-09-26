// HomeOps - domain skeleton (specification phase). Pure date math only.

import type { LocalDate } from '../../shared/types';
import type { ServiceFrequency } from './types';

/**
 * Compute the next service date from a frequency and the last service date (FR-MNT-004).
 * Date-based by design: DST never moves a service date, and "today" is the household day
 * (I-MNT-002, I-XA-006). Monthly/yearly rules clamp per occurrence and keep their intended day
 * (a "31st" plan stays on the 31st) - clamping must never become the new anchor (I-MNT-005).
 * MONTHS_OF_YEAR produces one date per selected month; a past month rolls to next year.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MNT-003 - requirements, ADR, design, and tests are listed there.
 */
export function computeNextServiceAt(_input: {
  readonly frequency: ServiceFrequency;
  readonly lastPerformedOn: LocalDate | null;
  readonly planStartOn: LocalDate;
}): LocalDate {
  throw new Error('Not implemented: T-MNT-003');
}

/**
 * Render a frequency as words ("every 6 months on the 15th", "April and October").
 * Reused verbatim by the plan detail page so the schedule is never shown as a raw rule object.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MNT-003 - requirements, ADR, design, and tests are listed there.
 */
export function describeFrequency(_frequency: ServiceFrequency): string {
  throw new Error('Not implemented: T-MNT-003');
}
