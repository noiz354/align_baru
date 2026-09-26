/**
 * AppShell — the page frame (landmarks + skip link).
 *
 * Requirements: NFR-A11Y-003/004 (landmarks, one h1 per page owned by
 * pages, skip-to-content as first focusable element).
 * Task: T-FOUND-004.
 *
 * Structure contract (ACCESSIBILITY.md §2):
 * - <a class="skip-link" href="#main"> (first focusable, visually hidden
 *   until focused)
 * - <header> with site nav (site name + primary nav)
 * - <main id="main"> (single main landmark)
 * - <footer> (minimal: site name, admin link for admins only)
 *
 * Intentionally a SKELETON: layout + landmarks only, no styling beyond
 * token references (tokens land in T-FOUND-004). No Tailwind utility soup
 * (code-volume rule: this phase defines structure, not production UI).
 */
import type { ReactNode } from 'react';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      {/* TODO(T-FOUND-004): skip link (first focusable, hidden until focused) */}
      {/* TODO(T-FOUND-004): <header> with nav (landmark, keyboard-operable) */}
      <main id="main">
        {children}
      </main>
      {/* TODO(T-FOUND-004): <footer> (minimal) */}
    </>
  );
}
