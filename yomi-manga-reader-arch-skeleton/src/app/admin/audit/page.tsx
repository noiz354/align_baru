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
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 7: features/admin emits through
 * the AuditSink port; handler `src/app/api/v1/admin/audit`.
 *
 * The audit trail is the security control behind NFR-SEC-012, so the before
 * and after values are rendered as TEXT in a `<pre>`, never interpreted as
 * markup, and the JSON view is a disclosure the user opens deliberately —
 * not something the list streams into the page.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audit',
};

export default function AdminAuditPage() {
  return (
    <>
      <h1>Audit</h1>
      {/* TODO(T-ADMIN-007): audit list + filters + before/after view */}
    </>
  );
}
