// HomeOps — civil-date arithmetic (T-TIME-002, ADR-007).
//
// Why this file exists separately from `clock.ts`: `LocalDate` values ('YYYY-MM-DD') are *civil*
// dates in the household timezone — they carry no instant and no offset, so adding days or months
// to them is pure calendar arithmetic and must never be done by adding 86_400_000 ms to a `Date`
// (that breaks on DST days: FR-CHORE-016, docs/product/RECURRENCE.md#dst).
//
// New file relative to the skeleton tree; justified in DECISIONS.md (2026-09-27, T-TIME-002).

import type { LocalDate } from '../types';

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type CivilDateParts = {
  readonly year: number;
  readonly month: number; // 1..12
  readonly day: number; // 1..31
};

/** Parse and validate a `LocalDate`. Returns null instead of throwing: callers decide the error code. */
export function parseLocalDate(value: string): CivilDateParts | null {
  const match = LOCAL_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isLocalDate(value: string): value is LocalDate {
  return parseLocalDate(value) !== null;
}

export function formatCivilDate(parts: CivilDateParts): LocalDate {
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${String(parts.year).padStart(4, '0')}-${month}-${day}` as LocalDate;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month1to12: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
  if (month1to12 === 2 && isLeapYear(year)) return 29;
  return lengths[month1to12 - 1] ?? 30;
}

/** Days since the Unix epoch for a civil date — used for comparisons and day arithmetic. */
export function toEpochDay(parts: CivilDateParts): number {
  // Date.UTC is safe here: we only want whole-day arithmetic on a civil date, never a wall clock.
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

export function fromEpochDay(epochDay: number): CivilDateParts {
  const date = new Date(epochDay * 86_400_000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Add whole days to a civil date (DST-safe by construction: no instants involved). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const parts = requireParts(date);
  return formatCivilDate(fromEpochDay(toEpochDay(parts) + days));
}

export function addWeeks(date: LocalDate, weeks: number): LocalDate {
  return addDays(date, weeks * 7);
}

/**
 * Clamp a day-of-month into the given year/month: `(2026, 2, 31)` → `'2026-02-28'`.
 *
 * This is the calendar primitive; the *policy* that keeps a rule anchored to its intended day lives
 * in `clamping.ts` (T-TIME-002), which re-exports it. The primitive sits here so that month
 * arithmetic in this file never has to import upward (the module graph is acyclic — asserted by
 * tests/unit/architecture.test.ts).
 */
export function clampDayToMonth(year: number, month1to12: number, day: number): LocalDate {
  if (month1to12 < 1 || month1to12 > 12) throw new RangeError(`month out of range: ${month1to12}`);
  const maxDay = daysInMonth(year, month1to12);
  return formatCivilDate({ year, month: month1to12, day: Math.min(Math.max(day, 1), maxDay) });
}

/**
 * Add months, clamping the day into the target month (Jan 31 + 1 month → Feb 28/29).
 * The *rule* keeps its intended day; only the occurrence clamps (ADR-007, I-CHORE-004).
 */
export function addMonthsClamped(date: LocalDate, months: number): LocalDate {
  const parts = requireParts(date);
  const total = parts.year * 12 + (parts.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  return clampDayToMonth(year, month, parts.day);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return toEpochDay(requireParts(a)) - toEpochDay(requireParts(b));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toEpochDay(requireParts(to)) - toEpochDay(requireParts(from));
}

/** 0 = Sunday … 6 = Saturday, matching the weekday numbering used by collection schedules. */
export function weekdayOf(date: LocalDate): number {
  const parts = requireParts(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

/** First day of the week containing `date`, honouring the household preference (FR-HH-007). */
export function startOfWeek(date: LocalDate, weekStartsOn: 'MONDAY' | 'SUNDAY'): LocalDate {
  const weekday = weekdayOf(date);
  const start = weekStartsOn === 'MONDAY' ? 1 : 0;
  const delta = (weekday - start + 7) % 7;
  return addDays(date, -delta);
}

/** True when `date` is the last day of its month — used to detect a clamped occurrence. */
export function isLastDayOfMonth(date: LocalDate): boolean {
  const parts = requireParts(date);
  return parts.day === daysInMonth(parts.year, parts.month);
}

function requireParts(date: LocalDate): CivilDateParts {
  const parts = parseLocalDate(date);
  // A malformed civil date is a programming error, not a member-facing outcome: every writer
  // validates with `isLocalDate` at the boundary (docs/api/CONVENTIONS.md §6).
  if (!parts) throw new TypeError(`Invalid LocalDate: ${date}`);
  return parts;
}
