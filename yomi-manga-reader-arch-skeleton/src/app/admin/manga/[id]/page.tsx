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
 */
export default function AdminMangaEditPage(/* { params } */) {
  return (
    <main>
      {/* TODO(T-ADMIN-002…005): metadata form + cover + publish + delete */}
    </main>
  );
}
