import { describe, expect, it } from 'vitest';
import { clampToMonth, isClamped } from '../../../../src/shared/time/clamping';
import { addMonthsClamped, daysInMonth, isLeapYear } from '../../../../src/shared/time/civil-date';

// Clamping is shared by chore recurrence and maintenance frequency (I-MNT-005).
// The rule keeps its intended day; only an occurrence clamps (ADR-007, I-CHORE-004,
// docs/product/RECURRENCE.md#month-clamping). T-CHORE-024, FR-CHORE-016.

describe('month and year clamping', () => {
  it('T-CHORE-024 FR-CHORE-016: the 31st clamps to 30 in a 30-day month and returns to the 31st afterwards', () => {
    expect(clampToMonth(2026, 4, 31)).toBe('2026-04-30'); // April has 30 days
    expect(clampToMonth(2026, 6, 31)).toBe('2026-06-30');
    expect(clampToMonth(2026, 5, 31)).toBe('2026-05-31'); // May has 31: no clamping
    // Stepping month by month *from the anchor* returns to the 31st — the clamp never becomes the
    // new anchor.
    const anchor = '2026-03-31';
    expect(addMonthsClamped(anchor, 1)).toBe('2026-04-30');
    expect(addMonthsClamped(anchor, 2)).toBe('2026-05-31');
    expect(addMonthsClamped(anchor, 3)).toBe('2026-06-30');
    expect(addMonthsClamped(anchor, 4)).toBe('2026-07-31');
    // Drift check: chaining from a clamped occurrence must not lose the anchor.
    let chained = anchor;
    for (let step = 0; step < 12; step += 1) chained = addMonthsClamped(anchor, step + 1);
    expect(chained).toBe('2027-03-31');
  });

  it('T-CHORE-024 FR-CHORE-016: February clamps to 28 or 29 and never drifts the rule', () => {
    expect(clampToMonth(2026, 2, 31)).toBe('2026-02-28');
    expect(clampToMonth(2026, 2, 30)).toBe('2026-02-28');
    expect(clampToMonth(2026, 2, 29)).toBe('2026-02-28'); // 2026 is not a leap year
    expect(clampToMonth(2028, 2, 29)).toBe('2028-02-29'); // 2028 is
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2100)).toBe(false); // divisible by 100, not by 400
    expect(daysInMonth(2028, 2)).toBe(29);

    const anchor = '2026-01-31';
    expect(addMonthsClamped(anchor, 1)).toBe('2026-02-28');
    expect(addMonthsClamped(anchor, 2)).toBe('2026-03-31'); // back to the intended day
    // Crossing a year boundary keeps the civil date arithmetic exact.
    expect(addMonthsClamped('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonthsClamped('2026-12-31', 14)).toBe('2028-02-29');
  });

  it('T-CHORE-024 FR-CHORE-016: 29 February annual rules clamp to 28 in non-leap years', () => {
    // An annual rule anchored on 29 February: +12 months lands in a non-leap year and clamps.
    expect(addMonthsClamped('2028-02-29', 12)).toBe('2029-02-28');
    expect(addMonthsClamped('2028-02-29', 24)).toBe('2030-02-28');
    expect(addMonthsClamped('2028-02-29', 48)).toBe('2032-02-29'); // next leap year: the anchor returns
    // The anchor is recognised as clamped so the next occurrence can return to the 29th.
    expect(isClamped('2029-02-28')).toBe(true);
    expect(isClamped('2028-02-29')).toBe(true); // last day of a leap February, day < 31
    expect(isClamped('2026-03-31')).toBe(false); // the intended day, no clamping needed
    expect(isClamped('2026-04-30')).toBe(true); // last day of April and day < 31
    expect(isClamped('not-a-date')).toBe(false);
  });

  it('T-CHORE-024 FR-CHORE-016: EVERY_N_MONTHS keeps its original day as the anchor across clampings', () => {
    // Every 2 months from 31 December: the anchor day (31) survives each clamp.
    const anchor = '2026-12-31';
    const expected = [
      '2027-02-28', // February clamps
      '2027-04-30', // April clamps
      '2027-06-30',
      '2027-08-31',
      '2027-10-31',
      '2027-12-31', // a full year later, back on the anchor
    ];
    for (let step = 1; step <= 6; step += 1) {
      expect(addMonthsClamped(anchor, step * 2), `anchor + ${step * 2} months`).toBe(expected[step - 1]);
    }
    // Every 3 months from 31 May, crossing a year boundary.
    expect(addMonthsClamped('2026-05-31', 3)).toBe('2026-08-31');
    expect(addMonthsClamped('2026-05-31', 9)).toBe('2027-02-28');
    // Negative steps move backwards with the same clamping semantics (a reschedule into the past).
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsClamped('2026-03-31', -2)).toBe('2026-01-31');
  });

  it('T-TIME-002: an out-of-range month is refused rather than wrapped', () => {
    expect(() => clampToMonth(2026, 13, 1)).toThrow(RangeError);
    expect(() => clampToMonth(2026, 0, 1)).toThrow(RangeError);
    // A day below 1 clamps up to the first of the month: a rule can never produce an invalid date.
    expect(clampToMonth(2026, 3, 0)).toBe('2026-03-01');
  });
});
