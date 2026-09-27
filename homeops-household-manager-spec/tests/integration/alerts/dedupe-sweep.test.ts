import { describe } from 'vitest';

// T-ALERT-033 - the fatigue guard suite. If this suite fails, the product nags.

describe.todo('dedupe sweep');
//   it.todo('T-ALERT-033 FR-ALERT-005: repeated ticks over three simulated days produce no duplicate alerts');
//   it.todo('T-ALERT-033 FR-ALERT-005: concurrent evaluation from two connections yields a single alert row');
//   it.todo('T-ALERT-033 FR-ALERT-005: a grouped resource alert refreshes as items join instead of multiplying');
//   it.todo('T-ALERT-033 FR-ALERT-005: manual resolution followed by re-detection creates exactly one new alert');
//   it.todo('T-ALERT-032 FR-ALERT-013: a quiet household day produces zero deliveries, not zero alerts');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
