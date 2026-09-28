/**
 * Library (`/library`) — authenticated shelf.
 *
 * Requirements: FR-LIBRARY-003/004, NFR-A11Y-004. Tasks: T-LIB-003 (UI), T-LIB-005 (history),
 * T-LIB-008 (bookmarks). Data: T-LIB-002 (list API), backed by T-LIB-001.
 *
 * ── Why this is not the grid yet ───────────────────────────────────────────
 * T-LIB-003 depends on T-LIB-002, and T-LIB-002 depends on T-LIB-001 — the library service
 * wiring, which `src/features/library/library.service.ts:63` still throws on. Building the
 * grid now would mean a page whose every control is wired to a service that cannot answer, and
 * AGENTS.md §4.3 is explicit that a real-looking surface over a throwing call is worse than no
 * surface: it moves the failure somewhere a reader will not look.
 *
 * The authenticated API the wave3 work added (`/api/library`, backed by
 * `server/db/queries/reader-state.ts`) does work and is covered by tests, but it is not this
 * page's data source: T-LIB-002 specifies a different contract with last-read denormalisation,
 * unread counts and cursor pagination, and this page should consume that one rather than a
 * near-miss that will have to be replaced.
 *
 * So the page says exactly that, names the task that unblocks it, and offers a real
 * destination — which is what ACCESSIBILITY.md §6 asks of every state.
 */
import type { Metadata } from 'next';
import { NotYetBuilt } from '../../shared/ui/StateRegion';

export const metadata: Metadata = {
  title: 'Library',
};

export default function LibraryPage() {
  return (
    <>
      <h1>Library</h1>
      <NotYetBuilt
        headingId="library-not-built"
        task="T-LIB-001"
        intent="show your shelf as a grid of covers, each with the chapter and page you reached, an unread count that is never colour-only, and a sort control — with an empty state that points at the catalog"
        actions={[
          { href: '/discover', label: 'Browse the catalog', primary: true },
          { href: '/', label: 'Go to the home page' },
        ]}
      />
    </>
  );
}
