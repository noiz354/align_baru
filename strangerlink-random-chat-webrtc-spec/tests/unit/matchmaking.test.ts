/**
 * Matchmaking tests — SKELETON.
 *
 * See:
 * - MATCHMAKING.md
 * - TESTING.md §1.2
 *
 * These are `describe.todo` placeholders.
 */

import { describe } from 'vitest';

describe('matchmaking eligibility', () => {
  describe.todo('does not match a participant who has left the queue');
  describe.todo('does not match blocked participants');
  describe.todo('does not match a banned participant');
  describe.todo('does not immediately rematch recent peers');
  describe.todo('never matches incompatible modes');
  describe.todo('applies a ban issued while the participant waits');
});

describe('matchmaking preferences', () => {
  describe.todo(
    'falls back to the general pool after the interest preference window',
  );
  describe.todo('falls back when no language match is available');
  describe.todo('never discloses interests to the peer');
});

describe('matchmaking concurrency', () => {
  describe.todo('resolves concurrent match attempts to one session');
  describe.todo('aborts a match when the participant cancels');
  describe.todo('creates a session for both peers or neither');
  describe.todo('resolves an expiry that races a match');
});
