/**
 * Admin layout (`/admin`) route shell — role=admin required (FR-AUTH-008).
 *
 * Requirements: FR-AUTH-008, NFR-A11Y-004, NFR-SEC-012 (audit presence).
 * Task: T-ADMIN-001.
 *
 * Contract: requireAdmin applied at the layout level (SSR guard) —
 * non-admin ⇒ 403 permission page (NOT a login redirect, per
 * admin-workflow.md §1); admin nav (dashboard, manga, uploads, users,
 * audit) as a `nav` landmark; every admin page no-store.
 * No feature code in this phase.
 */
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      {/* TODO(T-ADMIN-001): requireAdmin guard + admin nav (landmark) */}
      {children}
    </main>
  );
}
