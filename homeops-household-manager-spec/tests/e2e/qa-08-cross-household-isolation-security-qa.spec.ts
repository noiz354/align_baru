import { test } from '@playwright/test';

/**
 * QA-08 - Cross-household isolation (security QA) (mirrors QA.md section 2; keep both in step).
 * Viewport: D · Requirements: NFR-SEC-001, NFR-SEC-002, T-01, T-02 · Owning task: T-SEC-002.
 *
 * Steps: As Ayu (A), attempt: (1) open `/rooms/<B-room-id>`; (2) save a chore with roomId from B; (3) call `completeChoreOccurrence` with B's occurrence id; (4) list activity with a crafted cursor from B; (5) request an attachment id from B.
 * Expected: Every attempt returns `NOT_FOUND` (no existence disclosure); no data from B appears anywhere; no partial writes; the attempts appear in logs as failures **without content**.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-08 Cross-household isolation (security QA) [D]', () => {
  test.fixme('happy path: As Ayu (A), attempt: (1) open `/rooms/<B-room-id>`; (2) save a chore with roomId from B; (3) call `completeChoreOccurrence` with Bs occurrence id; (4)', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Guessing ids', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: malformed uuids', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: replayed Server Action payloads', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: a member who was removed mid-session (must be treated as unauthenticated).', async () => {
    // Skeleton only.
  });
});
