import { describe, it } from 'vitest';

// Privacy is enforced by types and asserted by tests (PRIVACY.md section 5, T-PRIV-002).

describe.todo('redaction');
//   it.todo('T-PRIV-002 NFR-PRIV-003: the logger type rejects forbidden fields (name, title, note, email, payload)');
//   it.todo('T-PRIV-002 NFR-PRIV-003: a runtime attempt to pass a forbidden field is dropped and counted, never logged');
//   it.todo('T-PRIV-002 NFR-OBS-006: metric labels reject household and member identifiers');
//   it.todo('T-PRIV-002 NFR-PRIV-003: error mapping strips payloads and SQL text from INTERNAL responses');

// All suites are todo: no product logic exists yet, and tests are never weakened to pass
// (AGENTS.md section 8: not-implemented is correct; a fake implementation is not).
