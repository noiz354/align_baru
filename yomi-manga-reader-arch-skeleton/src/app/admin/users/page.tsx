/**
 * Admin users (`/admin/users`) route shell.
 *
 * Requirements: FR-ADMIN-006, FR-AUTH-009, THREAT T-07 (last-admin guard).
 * Task: T-ADMIN-006.
 *
 * Behavior: cursor list (email, name, role, status, last login, created)
 * + email search; role change (reader↔admin) and disable/enable with the
 * last-admin guard surfaced (409 → explanation; UI disables the control
 * too, EC-ADM-04). No feature code in this phase.
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 7: features/admin orchestrates,
 * features/auth owns the role model and the last-admin guard (THREAT T-07);
 * handler `src/app/api/v1/admin/users*`.
 *
 * A user's email address is PII: it is rendered by this task's UI (T-ADMIN-
 * 006) but never in a URL, a log line or an analytics event (NFR-OBS-006).
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Users',
};

export default function AdminUsersPage() {
  return (
    <>
      <h1>Users</h1>
      {/* TODO(T-ADMIN-006): user list + role/status controls (guarded) */}
    </>
  );
}
