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
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 7: features/admin + features/
 * chapters; handler `src/app/api/v1/admin/chapters*`.
 *
 * Chapter numbers are `numeric(8,2)` and may be decimal (10.5) — DATA_MODEL
 * §2 — so the column is read with a mono, tabular figure, never a locale-
 * formatted string. That is T-ADMIN-004's row rendering.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chapters',
};

export default function AdminChaptersPage(/* { params } */) {
  return (
    <>
      <h1>Chapters</h1>
      {/* TODO(T-ADMIN-004): chapter table + create/edit + delete */}
      {/* TODO(T-UPLOAD-010): upload/re-ingest entry points */}
    </>
  );
}
