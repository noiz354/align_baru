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
import { NotYetBuilt } from '../../shared/ui/StateRegion';

export const metadata: Metadata = {
  title: 'Admin',
};

export default function AdminDashboardPage() {
  return (
    <>
      <h1>Admin</h1>
      <NotYetBuilt
        headingId="admin-not-built"
        task="T-ADMIN-008"
        intent="link together the admin sections that exist"
        actions={[{ href: '/discover', label: 'Browse the catalog', primary: true }]}
      />
      {/* TODO(T-ADMIN-008): stats + onboarding empty state */}
    </>
  );
}
