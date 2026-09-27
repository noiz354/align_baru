// HomeOps — the clock port and household-day math (T-TIME-001, T-TIME-003, ADR-007).
//
// The only way time enters the system (I-XA-005). No file under src/domain or src/features may call
// `new Date()` directly: recurrence, quiet hours, lead times, and DST correctness all depend on an
// injectable clock.

import type { Instant, LocalDate } from '../types';
import { addDays as addCivilDays } from './civil-date';
import {
  endOfLocalDay,
  instantFromCivil,
  isValidTimezone,
  localDateOf,
  startOfLocalDay,
  zonedPartsOf,
} from './timezone';

/** Current instant, as an ISO-8601 UTC string. In tests: a fixed or settable value. */
export type Clock = {
  now(): Instant;
};

/**
 * Household-local day boundary helpers. All "today" semantics flow through here (I-XA-006).
 * Day bounds are half-open: `[startUtc, endUtc)` — a DST day is 23 or 25 hours long and that is
 * correct, because the boundaries are civil, not arithmetic (FR-CHORE-011, FR-HH-008).
 */
export type HouseholdDay = {
  /** The household's current local date, e.g. '2026-10-04'. */
  today(): LocalDate;
  /** Bounds of the household's local day containing `instant`, as UTC instants. */
  dayBounds(instant: Instant): { readonly startUtc: Instant; readonly endUtc: Instant };
  /** Add a whole number of household days, preserving the wall-clock meaning. */
  addDays(date: LocalDate, days: number): LocalDate;
  /** Local date of any instant, in household terms. */
  localDate(instant: Instant): LocalDate;
  /** Start of the household-local day containing `instant`. */
  startOfDay(instant: Instant): Instant;
  /** Exclusive end of the household-local day containing `instant`. */
  endOfDay(instant: Instant): Instant;
  /** A civil date + 'HH:MM' rendered as the UTC instant the household means (DST-aware). */
  instantOn(date: LocalDate, time: 'HH:MM' | string): Instant;
  /** The household's timezone — carried so callers never re-derive it. */
  readonly timezone: string;
};

/** Production clock: the server's system time, which is authoritative for every write (T-TIME-001). */
export function createClock(): Clock {
  return {
    now: () => new Date().toISOString(),
  };
}

/**
 * Test clock (TP-5): a fixed instant that only moves when a test moves it. Never reads the wall
 * clock, so a suite that runs across midnight cannot flake.
 */
export function createFixedClock(start: Instant): Clock & {
  set(instant: Instant): void;
  advance(ms: number): void;
  advanceDays(days: number, timezone?: string): void;
} {
  let currentMs = Date.parse(start);
  if (Number.isNaN(currentMs)) throw new TypeError(`createFixedClock: invalid instant ${start}`);
  return {
    now: () => new Date(currentMs).toISOString(),
    set: (instant: Instant) => {
      const parsed = Date.parse(instant);
      if (Number.isNaN(parsed)) throw new TypeError(`set: invalid instant ${instant}`);
      currentMs = parsed;
    },
    advance: (ms: number) => {
      currentMs += ms;
    },
    advanceDays: (days: number, timezone = 'UTC') => {
      // Advancing by a *civil* day keeps the wall-clock reading stable across DST, which is what
      // recurrence tests need; advancing by 24 h does not (docs/product/RECURRENCE.md#dst).
      const current = new Date(currentMs).toISOString();
      const parts = zonedPartsOf(currentMs, timezone);
      const target = addCivilDays(localDateOf(current, timezone), days);
      currentMs = Date.parse(
        instantFromCivil({ date: target, hour: parts.hour, minute: parts.minute }, timezone),
      );
    },
  };
}

/** DST-aware local-day math; the household timezone is data, not configuration (ADR-007). */
export function createHouseholdDay(clock: Clock, timezone: string): HouseholdDay {
  if (!isValidTimezone(timezone)) throw new TypeError(`Unknown IANA timezone: ${timezone}`);
  return {
    timezone,
    today: () => localDateOf(clock.now(), timezone),
    dayBounds: (instant: Instant) => ({
      startUtc: startOfLocalDay(instant, timezone),
      endUtc: endOfLocalDay(instant, timezone),
    }),
    addDays: (date: LocalDate, days: number) => addCivilDays(date, days),
    localDate: (instant: Instant) => localDateOf(instant, timezone),
    startOfDay: (instant: Instant) => startOfLocalDay(instant, timezone),
    endOfDay: (instant: Instant) => endOfLocalDay(instant, timezone),
    instantOn: (date: LocalDate, time: string) => {
      const [hour, minute] = time.split(':').map(Number) as [number, number];
      return instantFromCivil({ date, hour: hour ?? 0, minute: minute ?? 0 }, timezone);
    },
  };
}
