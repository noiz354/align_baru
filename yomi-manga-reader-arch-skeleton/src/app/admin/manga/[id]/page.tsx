/**
 * Admin manga edit (`/admin/manga/[id]`) route shell.
 *
 * Requirements: FR-ADMIN-001/002/003/005, FR-ADMIN-007.
 * Tasks: T-ADMIN-002 (edit), T-ADMIN-003 (delete/restore), T-ADMIN-005
 * (publish), T-UPLOAD-011 (cover).
 *
 * Behavior: metadata form (all fields incl. aliases/creators/genres/
 * tags; slug immutable after first publish — EC-ADM-07), cover upload,
 * publish/unpublish toggle, soft-delete/restore (confirm dialog).
 * Every mutation ⇒ audit event (server-side). No feature code.
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 7: features/admin orchestrates,
 * features/manga owns the aggregate rules (slug immutability after first
 * publish — EC-ADM-07); handler `src/app/api/v1/admin/manga/[id]`.
 *
 * The heading is the surface name: the manga title is data, and a fixture
 * title in a shell would be the fake product data AGENTS.md §4.3 forbids.
 */
import type { Metadata } from 'next';
import { NotYetBuilt } from '../../../../shared/ui/StateRegion';

export const metadata: Metadata = {
  title: 'Manga',
};

export default function AdminMangaEditPage(/* { params } */) {
  return (
    <>
      <h1>Manga</h1>
      <NotYetBuilt
        headingId="admin-manga-edit-not-built"
        task="T-ADMIN-002…005"
        intent="edit a title’s metadata, cover, publication state and chapters"
        actions={[{ href: '/discover', label: 'Browse the catalog', primary: true }]}
      />
      {/* TODO(T-ADMIN-002…005): metadata form + cover + publish + delete */}
    </>
  );
}
