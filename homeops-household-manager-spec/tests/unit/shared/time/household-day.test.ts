import { describe, expect, it } from 'vitest';
import { createFixedClock, createHouseholdDay } from '../../../../src/shared/time/clock';
import { localDateOf } from '../../../../src/shared/time/timezone';

// Deterministic time is the foundation of recurrence, quiet hours, and due dates (I-XA-005, I-XA-006).
// T-TIME-003, T-TIME-004. No test here reads the wall clock or sleeps (TEST-DATA.md §3).

const JAKARTA = 'Asia/Jakarta'; // UTC+7, no DST
const BERLIN = 'Europe/Berlin'; // CET/CEST
const NEW_YORK = 'America/New_York';

describe('household day boundaries', () => {
  it('T-TIME-003 NFR-MAINT-002: today() uses the household timezone, not the server timezone', () => {
    // 23:30 UTC on 4 October: still the 4th in UTC and New York, already the 5th in Jakarta.
    const clock = createFixedClock('2026-10-04T23:30:00.000Z');
    expect(createHouseholdDay(clock, JAKARTA).today()).toBe('2026-10-05');
    expect(createHouseholdDay(clock, 'UTC').today()).toBe('2026-10-04');
    expect(createHouseholdDay(clock, NEW_YORK).today()).toBe('2026-10-04');
    // The server's own TZ must not matter: the same instant, a different process timezone.
    const previousTz = process.env.TZ;
    process.env.TZ = 'Pacific/Auckland';
    expect(createHouseholdDay(clock, JAKARTA).today()).toBe('2026-10-05');
    process.env.TZ = previousTz;
  });

  it('T-TIME-003 FR-HH-006: a UTC instant at 18:00 maps to tomorrow in Asia/Jakarta', () => {
    const clock = createFixedClock('2026-10-04T18:00:00.000Z');
    // 18:00 UTC + 7 h = 01:00 on the 5th in Jakarta.
    expect(createHouseholdDay(clock, JAKARTA).today()).toBe('2026-10-05');
    expect(localDateOf('2026-10-04T18:00:00.000Z', JAKARTA)).toBe('2026-10-05');
    // The boundary itself: 17:00 UTC is exactly midnight in Jakarta, and midnight belongs to the
    // new day (half-open interval, closed at the start).
    expect(createHouseholdDay(clock, JAKARTA).localDate('2026-10-04T17:00:00.000Z')).toBe('2026-10-05');
    expect(createHouseholdDay(clock, JAKARTA).localDate('2026-10-04T16:59:59.999Z')).toBe('2026-10-04');
  });

  it('T-TIME-003 FR-CHORE-011: day bounds are half-open and cover the whole local day', () => {
    const day = createHouseholdDay(createFixedClock('2026-10-04T00:00:00.000Z'), JAKARTA);
    const bounds = day.dayBounds('2026-10-04T05:00:00.000Z'); // 12:00 local on the 4th
    expect(bounds.startUtc).toBe('2026-10-03T17:00:00.000Z'); // 00:00 local
    expect(bounds.endUtc).toBe('2026-10-04T17:00:00.000Z'); // 00:00 local the next day, exclusive
    expect(day.startOfDay('2026-10-04T05:00:00.000Z')).toBe(bounds.startUtc);
    expect(day.endOfDay('2026-10-04T05:00:00.000Z')).toBe(bounds.endUtc);

    // Half-open: the start instant is inside the day, the end instant is the next day's start.
    expect(day.localDate(bounds.startUtc)).toBe('2026-10-04');
    expect(day.localDate(bounds.endUtc)).toBe('2026-10-05');
    // Consecutive days tile the timeline with no gap and no overlap.
    const next = day.dayBounds(bounds.endUtc);
    expect(next.startUtc).toBe(bounds.endUtc);
  });

  it('T-TIME-003 FR-CHORE-011: a DST day is 23 or 25 hours long, and the bounds stay civil', () => {
    // Berlin springs forward at 02:00 local on 2026-03-29: that local day has 23 hours.
    const forward = createHouseholdDay(createFixedClock('2026-03-29T06:00:00.000Z'), BERLIN);
    const forwardBounds = forward.dayBounds('2026-03-29T06:00:00.000Z');
    expect(forwardBounds.startUtc).toBe('2026-03-28T23:00:00.000Z');
    expect(forwardBounds.endUtc).toBe('2026-03-29T22:00:00.000Z');
    expect(Date.parse(forwardBounds.endUtc) - Date.parse(forwardBounds.startUtc)).toBe(23 * 3_600_000);

    // Berlin falls back at 03:00 local on 2026-10-25: that local day has 25 hours.
    const back = createHouseholdDay(createFixedClock('2026-10-25T06:00:00.000Z'), BERLIN);
    const backBounds = back.dayBounds('2026-10-25T06:00:00.000Z');
    expect(Date.parse(backBounds.endUtc) - Date.parse(backBounds.startUtc)).toBe(25 * 3_600_000);
    // A wall-clock time that does not exist (02:30 on the spring-forward day) resolves to a real
    // instant inside that day rather than throwing or drifting to another day.
    expect(forward.localDate(forward.instantOn('2026-03-29', '02:30'))).toBe('2026-03-29');
  });

  it('T-TIME-004 FR-HH-008: a timezone change moves future boundaries only, never past ones', () => {
    const clock = createFixedClock('2026-10-04T20:00:00.000Z'); // 03:00 on the 5th in Jakarta
    const before = createHouseholdDay(clock, JAKARTA);
    const pastInstant = '2026-10-01T05:00:00.000Z';
    const pastBoundsBefore = before.dayBounds(pastInstant);

    // The household changes timezone (FR-HH-008): a new helper is built from the same clock.
    const after = createHouseholdDay(clock, NEW_YORK);

    // Past facts keep the meaning they had: the local date of a stored instant is a pure function of
    // (instant, timezone), so re-deriving it in the new zone is a *read* difference, never a rewrite
    // of what already happened — and stored civil dates (due dates, away-until) are untouched.
    expect(before.localDate(pastInstant)).toBe('2026-10-01');
    expect(after.localDate(pastInstant)).toBe('2026-10-01');
    expect(pastBoundsBefore).toEqual(before.dayBounds(pastInstant));

    // Future boundaries move: "today" and the coming day bounds are now New York's.
    expect(before.today()).toBe('2026-10-05');
    expect(after.today()).toBe('2026-10-04');
    expect(after.dayBounds(clock.now()).startUtc).toBe('2026-10-04T04:00:00.000Z');
    // Civil arithmetic is zone-independent: adding a day means the next calendar day in both zones.
    expect(before.addDays('2026-10-04', 1)).toBe('2026-10-05');
    expect(after.addDays('2026-10-04', 1)).toBe('2026-10-05');
  });

  it('T-TIME-003: an unknown timezone is refused rather than silently defaulting', () => {
    const clock = createFixedClock('2026-10-04T00:00:00.000Z');
    expect(() => createHouseholdDay(clock, 'Asia/Jakartaa')).toThrow(TypeError);
    expect(() => createHouseholdDay(clock, '')).toThrow(TypeError);
  });
});
