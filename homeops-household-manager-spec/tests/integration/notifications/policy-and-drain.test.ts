import { describe, it } from 'vitest';

// Intent uniqueness, outbox drain semantics, retry classification, and dead-lettering (ADR-009).

describe.todo('drain');
//   it.todo('T-NOTIF-010 FR-NOTIF-006: draining twice delivers once (intent uniqueness on alert/member/channel/window)');
//   it.todo('T-NOTIF-010 FR-NOTIF-008: a dead-lettered intent is visible to operators and never retried forever');
//   it.todo('T-NOTIF-011 FR-NOTIF-006: a transient failure backs off, a permanent failure prunes the subscription');
//   it.todo('T-NOTIF-005 FR-ALERT-013: a cap overflow produces one digest, not a queue of suppressed items');
//   it.todo('T-NOTIF-002 FR-NOTIF-010: removing a member mid-lifecycle stops their future intents');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
