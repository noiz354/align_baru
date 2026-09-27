import { describe } from 'vitest';

// Role rules, the last-owner guarantee, and removal cascade (I-MEM-001..005).

describe.todo('membership');
//   it.todo('T-MEM-003 FR-MEM-002: ADMIN cannot demote or remove an OWNER');
//   it.todo('T-MEM-004 FR-MEM-006: removing a member deletes sessions and subscriptions in the same transaction');
//   it.todo('T-MEM-004 FR-MEM-006: removal reassigns or unassigns open items and keeps their history');
//   it.todo('T-MEM-005 FR-MEM-007: the last OWNER cannot leave (LAST_OWNER_CANNOT_LEAVE)');
//   it.todo('T-MEM-002 FR-MEM-003: an invitation is single-use, and a used token is rejected distinctly from an expired one');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
