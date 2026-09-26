import { test } from '@playwright/test';

/**
 * QA-02 - Invite and join (mirrors QA.md section 2; keep both in step).
 * Viewport: M · Requirements: FR-MEM-003, FR-MEM-004, FR-INVITE-security (T-08) · Owning task: T-MEM-002.
 *
 * Steps: Members → Invite → role MEMBER → copy link → open in a private window → sign up as Budi → accept.
 * Expected: Budi lands on `/today` of household A; activity shows `MemberJoinedHousehold`; invitation shows as accepted; Budi's role is MEMBER; no access to settings-level actions.
 *
 * Declared with Playwright's pending API (fixme). Unit and integration suites use the
 * Vitest `describe.todo` marker; both mean the same thing: specified, not implemented.
 */
test.describe.fixme('QA-02 Invite and join [M]', () => {
  test.fixme('happy path: Members → Invite → role MEMBER → copy link → open in a private window → sign up as Budi → accept.', async () => {
    // Skeleton only - there is no UI to drive in this phase.
  });
  test.fixme('edge case: Expired link', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: already-used link', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: revoked link', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: link opened by an existing member of A', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: accepting while signed in as a member of another household', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: role changed after invite but before accept (accepted role wins as documented)', async () => {
    // Skeleton only.
  });
  test.fixme('edge case: brute-force token guessing (rate-limited).', async () => {
    // Skeleton only.
  });
});
