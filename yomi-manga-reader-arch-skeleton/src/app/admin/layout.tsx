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
 *
 * ── What T-FOUND-003 adds here, and what it does not ─────────────────────
 * The layout nests INSIDE the root layout, so AppShell already provides the
 * page frame and the single `<main>`; this layout contributes the admin
 * sub-navigation as a second, separately named `nav` landmark (a page may
 * have more than one navigation landmark as long as each is distinguishable
 * — ACCESSIBILITY.md §2, and the rule that makes the landmark list usable).
 *
 * The link set is the route map (T-FOUND-003 makes the map clickable). The
 * guard is NOT implemented: requireAdmin needs a session, and a fake check
 * would be worse than none (AGENTS.md §4.3). TODO(T-ADMIN-001) stands.
 *
 * `no-store` is a per-route response concern (SECURITY.md §7: an admin page
 * must not be cached by a shared cache) and lands with the guard, because
 * Next's route-segment config is what sets it.
 */
import type { ReactNode } from 'react';
import { UiLink } from '../../shared/ui/Link';

const ADMIN_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/manga', label: 'Manga' },
  { href: '/admin/uploads', label: 'Uploads' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/audit', label: 'Audit' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* TODO(T-ADMIN-001): requireAdmin guard + `no-store` for the segment.
          A non-admin must get the 403 permission page, not a redirect to
          sign-in (admin-workflow.md §1). */}
      <nav className="admin-nav" aria-label="Admin">
        <ul>
          {ADMIN_NAV.map((item) => (
            <li key={item.href}>
              <UiLink href={item.href}>{item.label}</UiLink>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </>
  );
}
