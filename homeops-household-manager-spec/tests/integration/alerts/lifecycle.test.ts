import { describe, it } from 'vitest';

// Alert state machine against the database, including the partial unique index that makes dedupe real.

describe.todo('alert lifecycle');
//   it.todo('T-ALERT-004 FR-ALERT-005: evaluating with unchanged state creates nothing new (I-ALERT-008)');
//   it.todo('T-ALERT-015 FR-ALERT-007: acknowledging stops escalation and leaves the alert open with an owner');
//   it.todo('T-ALERT-016 FR-ALERT-008: a snoozed alert re-opens automatically after snoozedUntil');
//   it.todo('T-ALERT-017 FR-ALERT-009: manual resolution records a reason and warns when the condition persists');
//   it.todo('T-ALERT-010 FR-ALERT-009: every resolution path (complete, collect, restock, service, skip, cancel, pause, archive) closes its alert with a named reason');
//   it.todo('T-ALERT-012 NFR-SEC-009: every transition appends a row with actor and reason');

// Requires a scratch Postgres (tests/helpers/db.ts). Suites stay todo until their tasks start.
