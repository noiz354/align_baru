/**
 * Admin audit log (`/admin/audit`) route shell.
 *
 * Requirements: FR-ADMIN-007, NFR-SEC-012.
 * Task: T-ADMIN-007.
 *
 * Behavior: filterable cursor list (target kind/id), events with actor
 * (email; `<deleted>` provenance retained), action, before/after pretty
 * JSON (summarized, 2 KB/field cap), timestamps (local display, UTC
 * stored). Read-only surface (reads are not audited — documented).
 * No feature code in this phase.
 */
export default function AdminAuditPage() {
  return (
    <main>
      {/* TODO(T-ADMIN-007): audit list + filters + before/after view */}
    </main>
  );
}
