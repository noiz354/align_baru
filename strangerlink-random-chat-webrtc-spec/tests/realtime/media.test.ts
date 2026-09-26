/**
 * WebRTC browser tests — SKELETON.
 *
 * See:
 * - WEBRTC.md
 * - TESTING.md §1.10
 * - QA.md §2, §3
 *
 * When implemented, these use Playwright with fake device flags:
 * --use-fake-device-for-media-stream
 * --use-fake-ui-for-media-stream
 */

import { test } from '@playwright/test';

test.describe('media permissions', () => {
  test.todo('camera denied shows a recoverable state and continues in text');
  test.todo('microphone denied shows a recoverable state');
  test.todo('treats a dismissed prompt as denied');
  test.todo('continues in text when permission is revoked mid-session');
  test.todo('does not request media without a user gesture');
});

test.describe('media lifecycle', () => {
  test.todo('switches camera without ending the session');
  test.todo('shows a media failure state when the camera disappears');
  test.todo('shows a specific state on ICE timeout');
  test.todo('shows a specific state when TURN is unavailable');
  test.todo('restarts ICE on network change');
  test.todo('stops all tracks on session end');
  test.todo('no code path calls MediaRecorder');
});
