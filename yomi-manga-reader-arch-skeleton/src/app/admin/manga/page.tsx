/**
 * Admin manga list (`/admin/manga`) route shell.
 *
 * Requirements: FR-ADMIN-001/003, FR-ADMIN-007.
 * Task: T-ADMIN-002 (list + create entry).
 *
 * Behavior: cursor list (title, status, chapter count, publish state,
 * deleted flag), "New manga" action (form → FR-ADMIN-001), filter
 * (status/deleted). Destructive actions require confirm dialogs
 * (admin-workflow.md §10). No feature code in this phase.
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 7: features/admin (+ features/manga
 * for slug generation); handlers `src/app/api/v1/admin/manga*`.
 */
import type { Metadata } from 'next';
import { NotYetBuilt } from '../../../shared/ui/StateRegion';

export const metadata: Metadata = {
  title: 'Manga',
};

export default function AdminMangaListPage() {
  return (
    <>
      <h1>Manga</h1>
      <NotYetBuilt
        headingId="admin-manga-not-built"
        task="T-ADMIN-002"
        intent="list every title and start a new one"
        actions={[{ href: '/discover', label: 'Browse the catalog', primary: true }]}
      />
      {/* TODO(T-ADMIN-002): manga list + create form entry */}
    </>
  );
}
