/**
 * Retention and schema-guard integration tests — SKELETON.
 *
 * See:
 * - RETENTION.md
 * - TESTING.md §1.8
 * - THREAT_MODEL.md T-30, T-31
 *
 * These are `describe.todo` placeholders. When implemented, these run against
 * a real PostgreSQL instance in a service container.
 */

import { describe } from 'vitest';

describe('retention job', () => {
  describe.todo('deletes expired session metadata rows');
  describe.todo('deletes expired report rows');
  describe.todo('deletes expired audit rows');
  describe.todo('deletes expired risk signal rows');
  describe.todo('is idempotent when re-run');
  describe.todo('alerts on failure');
});

describe('schema guard', () => {
  describe.todo('no message-content column exists');
  describe.todo('no media reference column exists');
  describe.todo('no name, email, or phone column exists');
  describe.todo('AuditEvent has no UPDATE or DELETE grant for the app role');
});

describe('database access boundary', () => {
  describe.todo('no module outside src/server/db imports a database driver');
});
