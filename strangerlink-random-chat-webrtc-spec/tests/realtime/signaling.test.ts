/**
 * Realtime signaling protocol tests — SKELETON.
 *
 * See:
 * - SIGNALING.md
 * - TESTING.md §1.9
 * - THREAT_MODEL.md T-01, T-02, T-03, T-11
 *
 * These are `describe.todo` placeholders. When implemented, these tests use
 * a REAL `ws` server in-process — not a mock.
 */

import { describe } from 'vitest';

describe('handshake', () => {
  describe.todo('refuses an unauthenticated upgrade');
  describe.todo('refuses a disallowed origin');
  describe.todo('refuses a banned identity at connect');
});

describe('envelope validation', () => {
  describe.todo('rejects a malformed frame');
  describe.todo('rejects an oversized frame');
  describe.todo('rejects a message containing toParticipantId');
});

describe('authorization', () => {
  describe.todo(
    'rejects a message whose fromParticipantId is not the authenticated identity',
  );
  describe.todo(
    'cannot deliver a message to a participant not in the session',
  );
});

describe('idempotency and ordering', () => {
  describe.todo('drops a duplicate messageId');
  describe.todo('handles an out-of-order sequence');
  describe.todo('drops a message after the reorder buffer is exhausted');
});

describe('reconnect and supersession', () => {
  describe.todo('rejects a reconnect to a stale session id');
  describe.todo('supersedes an older socket');
  describe.todo('terminates a zombie socket');
  describe.todo('rate limits frames per connection');
});
