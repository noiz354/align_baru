import { describe } from 'vitest';

// T-SEC-002 - the release-blocking isolation sweep. One case per repository port using the
// HH_MAIN / HH_CONTROL fixtures (docs/testing/TEST-DATA.md section 7). A new port must add rows here.

describe.todo('isolation sweep: crafted ids across households');
//   it.todo('T-SEC-002 NFR-SEC-002: every repository findById with a foreign id returns null or NOT_FOUND');
//   it.todo('T-SEC-002 FR-HH-003: any read model never returns rows from another household');
//   it.todo('T-SEC-002 FR-HH-003: nested children (occurrences, comments, records, attachments) are scoped through their parent');
//   it.todo('T-SEC-002 NFR-SEC-002: a job run with two households never leaks rows across them');
//   it.todo('T-SEC-002 NFR-SEC-002: attachment serving rejects a foreign household with 404, never 403');
//   it.todo('T-SEC-002 FR-HH-004: a household id supplied in a payload is ignored in favour of the session');
//   it.todo('T-SEC-002 FR-HH-004: findMembershipHousehold returns only the caller\'s household and nothing for a non-member');
//   it.todo('T-SEC-002 FR-HH-004: consumeByTokenHash is single-use and cannot be replayed after acceptance');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
