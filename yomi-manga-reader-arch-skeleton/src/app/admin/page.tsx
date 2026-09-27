/**
 * Admin dashboard (`/admin`) route shell.
 *
 * Requirements: FR-ADMIN-008, FR-AUTH-008 (first-admin onboarding).
 * Task: T-ADMIN-008.
 *
 * Behavior: stats (counts + upload health 24 h/30 d); empty-catalog
 * onboarding ("No manga yet — create your first title") for fresh
 * instances (admin-workflow.md §2). No feature code in this phase.
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 7: features/admin owns stats
 * assembly; handler `src/app/api/v1/admin/*`. The admin nav landmark is
 * rendered by `admin/layout.tsx`, not here.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin',
};

export default function AdminDashboardPage() {
  return (
    <>
      <h1>Admin</h1>
      {/* TODO(T-ADMIN-008): stats + onboarding empty state */}
    </>
  );
}
