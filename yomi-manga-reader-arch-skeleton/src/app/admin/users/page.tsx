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
 */
export default function AdminUsersPage() {
  return (
    <main>
      {/* TODO(T-ADMIN-006): user list + role/status controls (guarded) */}
    </main>
  );
}
