import { describe } from 'vitest';

// T-SEC-001/T-SEC-003 - the matrix in docs/security/AUTHZ-MATRIX.md is executed, not merely agreed.

describe.todo('authorization matrix');
//   it.todo('T-SEC-001 NFR-SEC-001: every operation in API.md has a matrix row and a negative test');
//   it.todo('T-SEC-003 FR-MEM-010: HELPER is refused recurring-chore creation, snooze, and issue close');
//   it.todo('T-SEC-003 FR-MEM-010: MEMBER is refused household settings, invitations, and exports');
//   it.todo('T-SEC-003 NFR-SEC-009: every denial writes an audit row with ids and outcome only');
//   it.todo('T-SEC-001 NFR-SEC-001: removing a role check turns at least one test red (no silent privilege path)');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
