/**
 * Chat tests — SKELETON.
 *
 * See:
 * - CHAT.md
 * - TESTING.md §1.4
 */

import { describe } from 'vitest';

describe('chat ordering and limits', () => {
  describe.todo('orders messages by sequence');
  describe.todo('rejects a message over the length limit');
  describe.todo('rate limits messages per session');
  describe.todo('rejects identical content after the threshold');
  describe.todo('does not persist message content');
});

describe('chat concurrency (C1-C6)', () => {
  describe.todo('drops a duplicate sequence number');
  describe.todo('renders available messages after the buffer window');
  describe.todo('rejects a message sent as the session ends');
  describe.todo('treats the server sequence as authoritative on reconnect');
  describe.todo('handles simultaneous sends with independent sequences');
  describe.todo('drops a message when the peer socket is gone');
});
