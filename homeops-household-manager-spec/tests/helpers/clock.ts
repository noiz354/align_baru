// HomeOps — the fake clock and the named instants (T-PLAT-016, docs/testing/TEST-DATA.md §3).
//
// No test may call `new Date()` or sleep: time is injected, and these are the canonical instants the
// DST suites share. Each is documented with the wall-clock meaning it has in its zone, verified
// against `Intl` (the values below are literal UTC instants, not computed at import time, so a
// regression in the timezone helpers cannot silently redefine a fixture).

import { createFixedClock } from '../../src/shared/time/clock';
import type { Instant } from '../../src/shared/types';

export type TestClock = ReturnType<typeof createFixedClock>;

/** A clock frozen at `instant`; it moves only when a test moves it (TP-5). */
export function testClock(instant: Instant = JAKARTA_NO_DST): TestClock {
  return createFixedClock(instant);
}

/* ------------------------------------------------------------------ Asia/Jakarta (UTC+7, no DST) */

/** 2026-10-05 01:00 WIB — the evening-of-the-4th-in-UTC case used by FR-HH-006. */
export const JAKARTA_NO_DST = '2026-10-04T18:00:00.000Z';
/** 2026-10-05 00:00 WIB — the household day boundary, exactly. */
export const JAKARTA_MIDNIGHT = '2026-10-04T17:00:00.000Z';
/** 2026-10-05 07:00 WIB — a typical morning chore time. */
export const JAKARTA_MORNING = '2026-10-05T00:00:00.000Z';

/* ------------------------------------------- Europe/Berlin, spring forward 2026-03-29 (CET→CEST) */

/** 2026-03-29 01:30 CET — the last half hour before the gap; unambiguous. */
export const BERLIN_DST_FORWARD_01_30 = '2026-03-29T00:30:00.000Z';
/**
 * The civil time 02:30 on 2026-03-29 **does not exist** in Berlin (02:00 CET jumps to 03:00 CEST).
 * This is the instant the resolution rule produces: the first valid instant at or after the request,
 * whose local reading is 03:00 CEST. The shift is not lateness (docs/product/RECURRENCE.md#dst).
 */
export const BERLIN_DST_FORWARD_02_30 = '2026-03-29T01:00:00.000Z';
/** 2026-03-29 00:00 CET — the local day starts before the transition and is 23 hours long. */
export const BERLIN_DST_FORWARD_MIDNIGHT = '2026-03-28T23:00:00.000Z';

/* --------------------------------------------- Europe/Berlin, fall back 2026-10-25 (CEST→CET) */

/** 2026-10-25 01:30 CEST — an hour before the transition; unambiguous. */
export const BERLIN_DST_BACK_01_30 = '2026-10-24T23:30:00.000Z';
/** 2026-10-25 02:30 CEST — the **first** of the two occurrences of local 02:30. */
export const BERLIN_DST_BACK_02_30_FIRST = '2026-10-25T00:30:00.000Z';
/** 2026-10-25 02:30 CET — the **second** occurrence. Ambiguity resolves to the first (00:30Z). */
export const BERLIN_DST_BACK_02_30_SECOND = '2026-10-25T01:30:00.000Z';

/* ----------------------------------- Pacific/Auckland, fall back 2026-04-05 (NZDT→NZST, southern) */

/** The transition instant: 2026-04-05 03:00 NZDT becomes 02:00 NZST. */
export const AUCKLAND_DST_BACK = '2026-04-04T14:00:00.000Z';
/** 2026-04-05 02:30 NZDT — first occurrence of the ambiguous local time. */
export const AUCKLAND_DST_BACK_02_30_FIRST = '2026-04-04T13:30:00.000Z';
/** 2026-04-05 02:30 NZST — second occurrence. */
export const AUCKLAND_DST_BACK_02_30_SECOND = '2026-04-04T14:30:00.000Z';

/* ------------------------------------------------------- America/New_York (US DST, western rule) */

/** 2026-11-01 00:00 EDT — the local day that contains the US fall-back at 02:00 (25 hours long). */
export const NEW_YORK_DST_BACK_MIDNIGHT = '2026-11-01T04:00:00.000Z';
