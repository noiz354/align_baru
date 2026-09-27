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
 *
 * ── Why the pages below render no <main> of their own ────────────────────
 * The shell owns the single main landmark, so a page that also rendered one
 * would put two `main` elements in the DOM (ACCESSIBILITY.md §2: "one
 * `main` per page"). `tabIndex={-1}` on the target is what makes the skip
 * link actually move focus: a fragment link only focuses its target when the
 * target is programmatically focusable, and it must not become a tab stop.
 *
 * ── Why the skip link cannot be preceded ──────────────────────────────────
 * The root layout renders nothing focusable above <AppShell> (no theme
 * script, no pre-header control), and this is the first element the shell
 * emits — so it is the first focusable element in the document on every
 * route. E2E-FOUND-001 asserts it by pressing Tab as the first interaction
 * on every route in the map, which is the only way to keep the claim honest.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { UiLink } from './Link';

/**
 * The planned route map, in nav order (T-FOUND-003). These are links to
 * planned routes, not product data: this phase makes the map clickable so
 * the shells can be walked in a browser.
 *
 * TODO(T-AUTH-003): the library/history/bookmarks/settings group is
 * authenticated — it is rendered unconditionally here because a session
 * does not exist yet. T-AUTH-003 owns the authenticated nav.
 */
const PRIMARY_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/discover', label: 'Catalog' },
  { href: '/search', label: 'Search' },
  { href: '/library', label: 'Library' },
  { href: '/history', label: 'History' },
  { href: '/bookmarks', label: 'Bookmarks' },
  { href: '/settings', label: 'Settings' },
];

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Skip link: FIRST focusable element in the document (NFR-A11Y-003,
          ACCESSIBILITY.md §4). Off-screen until focused, so it costs no
          layout and is never the first thing a pointer sees. */}
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="shell-header">
        <div className="shell-header__in">
          {/* The wordmark is a link home, not the page's h1: the h1 belongs
              to the page (ACCESSIBILITY.md §2). */}
          <Link className="brand" href="/">
            Yomi
          </Link>
          <nav className="shell-nav" aria-label="Site">
            <ul>
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <UiLink href={item.href}>{item.label}</UiLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="shell-main" id="main" tabIndex={-1}>
        {children}
      </main>

      <footer className="shell-footer">
        <div className="shell-footer__in">
          <p>Yomi — self-hosted manga &amp; comic reader.</p>
          {/* TODO(T-AUTH-003): the admin link is admin-only and depends on
              the session; it is not rendered until roles exist. */}
        </div>
      </footer>
    </>
  );
}
