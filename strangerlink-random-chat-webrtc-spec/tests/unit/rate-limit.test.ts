/**
 * Rate limit and cooldown tests — SKELETON.
 *
 * See:
 * - ABUSE_PREVENTION.md
 * - TESTING.md §1.7
 * - THREAT_MODEL.md T-24
 */

import { describe } from 'vitest';

describe('rate limiting', () => {
  describe.todo('enforces every documented limit');
  describe.todo('keys limits on identity, not on connection');
  describe.todo('records a safety event on every trigger');
});

describe('cooldown ladder', () => {
  describe.todo('applies a progressive cooldown');
  describe.todo('escalates the cooldown on repeated triggers');
});

describe('risk signals', () => {
  describe.todo('a shared-IP signal cannot trigger a standalone ban');
  describe.todo('expires a risk signal after 7 days');
});
