// HomeOps — timezone conversion primitives (T-TIME-001, T-TIME-003, ADR-007).
//
// The household timezone is *data*, not configuration: it is stored per household and every
// "today"/due-date decision flows through these helpers with an injected instant, so no domain code
// ever calls `new Date()` (I-XA-005) and no test depends on the server's timezone (TP-5).
//
// New file relative to the skeleton tree; justified in DECISIONS.md (2026-09-27, T-TIME-001).

import type { Instant, LocalDate } from '../types';
import { addDays, formatCivilDate, type CivilDateParts } from './civil-date';

type Formatter = Intl.DateTimeFormat;
const formatterCache = new Map<string, Formatter>();

/** Validated zones, cached: validation constructs a formatter, which is not free. */
const validatedZones = new Set<string>();
const rejectedZones = new Set<string>();

/**
 * IANA validation for a household timezone (I-HH-001, FR-HH-006).
 *
 * Deliberately not `Intl.supportedValuesOf('timeZone')`: that list contains canonical ids only, so
 * it rejects `UTC` — a real IANA identifier a household may legitimately pick. Asking the runtime to
 * format in the zone is the capability that actually matters, and comparing the *resolved* id keeps
 * stored values canonical: `utc` and the legacy alias `Asia/Calcutta` are refused, `UTC` and
 * `Asia/Kolkata` are accepted.
 */
export function isValidTimezone(timezone: string): boolean {
  if (typeof timezone !== 'string' || timezone.length === 0 || timezone.length > 64) return false;
  if (validatedZones.has(timezone)) return true;
  if (rejectedZones.has(timezone)) return false;
  let valid = false;
  try {
    valid = new Intl.DateTimeFormat('en-US', { timeZone: timezone }).resolvedOptions().timeZone === timezone;
  } catch {
    valid = false; // an unknown zone throws a RangeError
  }
  (valid ? validatedZones : rejectedZones).add(timezone);
  return valid;
}

/** The household's default timezone when none is supplied at sign-up (FR-HH-002). */
export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

function formatter(timezone: string): Formatter {
  const cached = formatterCache.get(timezone);
  if (cached) return cached;
  // en-US + hour12:false gives stable, parseable numeric parts across runtimes.
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  formatterCache.set(timezone, created);
  return created;
}

export type ZonedParts = CivilDateParts & {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  /** Minutes east of UTC at this instant (negative west). */
  readonly offsetMinutes: number;
};

/** Wall-clock parts of an instant in a timezone, plus the offset in effect. */
export function zonedPartsOf(instantMs: number, timezone: string): ZonedParts {
  const parts = formatter(timezone).formatToParts(new Date(instantMs));
  const read = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  const year = read('year');
  const month = read('month');
  const day = read('day');
  let hour = read('hour');
  // Intl renders midnight as 24 with hour12:false on some runtimes.
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(year, month - 1, day, hour, read('minute'), read('second'));
  const offsetMinutes = Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / 60_000);
  return { year, month, day, hour, minute: read('minute'), second: read('second'), offsetMinutes };
}

/** Civil date of an instant in a timezone — the value stored in `date` columns. */
export function localDateOf(instant: Instant, timezone: string): LocalDate {
  const parts = zonedPartsOf(Date.parse(instant), timezone);
  return formatCivilDate({ year: parts.year, month: parts.month, day: parts.day });
}

/** 'HH:MM' wall-clock time of an instant in a timezone. */
export function localTimeOf(instant: Instant, timezone: string): string {
  const parts = zonedPartsOf(Date.parse(instant), timezone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

/** Minutes since local midnight — used to order events inside one household day. */
export function localMinutesOfDay(instant: Instant, timezone: string): number {
  const parts = zonedPartsOf(Date.parse(instant), timezone);
  return parts.hour * 60 + parts.minute;
}

type CivilTime = { readonly date: LocalDate; readonly hour: number; readonly minute: number };

/**
 * Convert a civil date + wall-clock time in a timezone to a UTC instant.
 *
 * DST rules (docs/product/RECURRENCE.md#dst):
 *  - ambiguous local time (fall-back, occurs twice) → the **first** occurrence;
 *  - non-existent local time (spring-forward gap) → the first valid instant of that civil day
 *    at or after the requested wall time (02:30 → 03:00), and the shift is not lateness.
 */
export function instantFromCivil(input: CivilTime, timezone: string): Instant {
  const [year, month, day] = input.date.split('-').map(Number) as [number, number, number];
  const asUtc = Date.UTC(year, month - 1, day, input.hour, input.minute);
  const targetMinutes = epochDay(input.date) * 1440 + input.hour * 60 + input.minute;

  // Probe a window around the naive UTC guess: DST shifts are at most a few hours, and a 26 h
  // probe also covers date-line and southern-hemisphere offsets.
  const probes = [
    asUtc - 26 * 3_600_000,
    asUtc - 3_600_000,
    asUtc,
    asUtc + 3_600_000,
    asUtc + 26 * 3_600_000,
  ];
  const offsets = new Set<number>();
  for (const probe of probes) offsets.add(zonedPartsOf(probe, timezone).offsetMinutes);

  const matching: number[] = [];
  for (const offsetMinutes of offsets) {
    const candidate = asUtc - offsetMinutes * 60_000;
    const parts = zonedPartsOf(candidate, timezone);
    const sameWallClock =
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === input.hour &&
      parts.minute === input.minute;
    if (sameWallClock) matching.push(candidate);
  }
  // Fall-back ambiguity: both candidates are real; the first occurrence wins.
  if (matching.length > 0) return new Date(Math.min(...matching)).toISOString();

  // Spring-forward gap: binary-search the first instant whose local wall-clock reading is at or
  // after the requested one (local time is monotonic increasing across a forward transition).
  let low = asUtc - 26 * 3_600_000;
  let high = asUtc + 26 * 3_600_000;
  // To millisecond precision: the invariant is "predicate(high) is true, predicate(low) is false",
  // so `high` is the *first* instant at or after the requested wall time. Stopping a second early
  // left sub-second residue on the result (02:30 → 01:00:00.603Z), which made due-time comparisons
  // and member-facing timestamps noisy. Real transitions fall on a whole minute, so the converged
  // value is exact (02:30 → 01:00:00.000Z, whose local reading is 03:00).
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (localMinutesSinceEpoch(mid, timezone) >= targetMinutes) high = mid;
    else low = mid;
  }
  return new Date(high).toISOString();
}

/** Start of the household-local day containing `instant`, as a UTC instant (I-XA-006). */
export function startOfLocalDay(instant: Instant, timezone: string): Instant {
  return instantFromCivil({ date: localDateOf(instant, timezone), hour: 0, minute: 0 }, timezone);
}

/** Exclusive end of the household-local day: start of the next local day (half-open, FR-CHORE-011). */
export function endOfLocalDay(instant: Instant, timezone: string): Instant {
  const tomorrow = addDays(localDateOf(instant, timezone), 1);
  return instantFromCivil({ date: tomorrow, hour: 0, minute: 0 }, timezone);
}

function localMinutesSinceEpoch(instantMs: number, timezone: string): number {
  const parts = zonedPartsOf(instantMs, timezone);
  return (
    epochDay(formatCivilDate({ year: parts.year, month: parts.month, day: parts.day })) * 1440 +
    parts.hour * 60 +
    parts.minute
  );
}

function epochDay(date: LocalDate): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}
