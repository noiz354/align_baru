import { describe, it } from 'vitest';

// The anti-stacking and idempotency guarantees, exercised against a real database (I-CHORE-001/003).

describe.todo('materialisation');
//   it.todo('T-CHORE-010 FR-CHORE-017: running the job twice creates exactly one occurrence');
//   it.todo('T-CHORE-019 FR-CHORE-017: two concurrent runs lose the race on the unique index and one wins cleanly');
//   it.todo('T-CHORE-010 FR-CHORE-017: an occurrence_key collision is treated as success, not as an error');
//   it.todo('T-CHORE-010 FR-CHORE-017: paused and archived definitions materialise nothing');
//   it.todo('T-CHORE-010 FR-CHORE-017: a tick after a two-day outage produces exactly one occurrence');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
