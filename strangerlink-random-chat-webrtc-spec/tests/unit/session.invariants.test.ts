/**
 * Session invariant tests — SKELETON.
 *
 * See:
 * - STATE_MACHINE.md §4 (INV-1 … INV-8)
 * - TESTING.md §1.1
 *
 * These are `describe.todo` placeholders. They fail loudly if run, which is
 * the point: an unimplemented test must not silently pass.
 */

import { describe, it } from 'vitest';

describe('session invariants', () => {
  describe.todo('prevents one participant from entering two active sessions');
  describe.todo('rejects a session with identical participants');
  describe.todo('rejects an undocumented transition');
  describe.todo('does not reactivate a terminal session');
  describe.todo('never accepts a client-supplied session id');
});

describe('session transition table', () => {
  describe.todo('permits every documented transition');
  describe.todo('rejects every undocumented transition');
  describe.todo('emits the documented event for every transition');
});
