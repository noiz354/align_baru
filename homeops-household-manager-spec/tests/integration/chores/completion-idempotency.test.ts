import { describe } from 'vitest';

// One tap must mean one completion, even with retries, double taps, and stale tabs (I-CHORE-002).

describe.todo('completion');
//   it.todo('T-CHORE-004 FR-CHORE-005: replaying the same clientRequestId returns the original result with deduped = true');
//   it.todo('T-CHORE-004 FR-CHORE-004: a completion resolves the occurrence alerts with reason COMPLETED');
//   it.todo('T-CHORE-004 FR-CHORE-011: completing an occurrence updates the room's derived status on the next read');
//   it.todo('T-CHORE-007 FR-CHORE-015: skipping does not advance a completion-anchored series');
//   it.todo('T-CHORE-005 FR-CHORE-005: reopening outside the window is refused for a MEMBER and allowed for an ADMIN with a reason');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
