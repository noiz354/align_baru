import { describe } from 'vitest';

// Every job must be safe to run twice; this suite is the evidence (ADR-013).

describe.todo('job idempotency');
//   it.todo('T-PLAT-010 NFR-REL-004: every job in JOB_NAMES changes nothing on a second run with unchanged state');
//   it.todo('T-PLAT-010 NFR-REL-004: two concurrent runs acquire the lock and the loser exits without error');
//   it.todo('T-OBS-005 NFR-OBS-003: a stalled job is detectable from tick age alone');
//   it.todo('T-ALERT-027 FR-ALERT-005: a failure in one household does not stop evaluation for the others');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
