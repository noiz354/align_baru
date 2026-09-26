import { test } from '@playwright/test';

/**
 * QA-14 - PWA install, offline and staleness (mirrors QA.md section 2; keep both in step).
 * Viewport: M (Android Chrome + iOS Safari) · Requirements: FR-PWA-001..004, ADR-014 · Owning task: T-PWA-003.
 *
 * Steps: Install from the home screen; open offline; attempt to complete a chore offline; return online and refresh.
 * Expected: Install prompt appears only after meaningful engagement; offline shows the shell with the staleness banner ("Last updated …") on `/today`; the offline mutation fails visibly with retry (no silent queue); online refresh shows current state; update prompt appears after a new deploy ("Updated — reload").
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-14 PWA install, offline and staleness [M (Android Chrome + iOS Safari)]', () => {
  test.fixme('happy path: Install from the home screen; open offline; attempt to complete a chore offline; return online and refresh.', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: iOS manual install path documented in settings', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: push permission requested only from settings', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: service worker cache version bump', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: stale shell after deploy', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: storage pressure on iOS', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: airplane-mode toggle mid-action.', async () => {
    // Skeleton only.
  });
});
