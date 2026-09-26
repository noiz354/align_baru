/**
 * Playwright configuration - PHASE 0 SKELETON (T-TEST-001).
 *
 * E2E scenarios live in TESTING.md §6.3 and run against a composed stack (ops/docker-compose.test.yml):
 *   1. discovery -> attendance        4. transcription -> review -> publish
 *   2. entrance drill (200 seeded)    5. offline participant code
 *   3. recording survival             6. cancel and waitlist
 * Fake media devices (T-TEST-001):
 *   --use-fake-device-for-media-stream --use-fake-ui-for-media-stream   (recorder)
 *   --use-file-for-fake-video-capture=<fixture>.y4m                     (scanner QR fixtures)
 *
 * Phase 0: not runnable (no browsers installed). Baselines for the safety-critical layouts are stored
 * in the repo and updated only by an explicitly reviewed commit.
 */
export default {
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    // TODO(T-TEST-001): permissions (camera/microphone), offline contexts, CDP throttling
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" }, grep: /@webkit/ },
  ],
};
