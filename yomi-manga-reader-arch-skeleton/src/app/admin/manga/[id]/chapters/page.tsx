/**
 * Admin chapters (`/admin/manga/[id]/chapters`) route shell.
 *
 * Requirements: FR-ADMIN-004/005, FR-UPLOAD-011 (upload panel entry),
 * FR-ADMIN-007.
 * Tasks: T-ADMIN-004 (CRUD), T-UPLOAD-010 (upload panel).
 *
 * Behavior: chapter table (number, title, page count, publish state,
 * created), create/edit forms (number uniqueness → 409), soft-delete
 * (confirm), publish/unpublish (≥ 1 page rule, EC-ADM-08), "Upload
 * pages / Re-ingest" actions (→ upload flow, admin-workflow.md §5).
 * No feature code in this phase.
 */
export default function AdminChaptersPage(/* { params } */) {
  return (
    <main>
      {/* TODO(T-ADMIN-004): chapter table + create/edit + delete */}
      {/* TODO(T-UPLOAD-010): upload/re-ingest entry points */}
    </main>
  );
}
