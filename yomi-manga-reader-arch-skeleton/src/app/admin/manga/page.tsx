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
 */
export default function AdminMangaListPage() {
  return (
    <main>
      {/* TODO(T-ADMIN-002): manga list + create form entry */}
    </main>
  );
}
