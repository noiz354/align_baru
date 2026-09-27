/**
 * Home (`/`) route shell.
 *
 * Requirements: FR-LIBRARY-005 (continue-reading for members),
 * FR-CATALOG-001 (catalog preview for anonymous), NFR-PERF-001 (LCP).
 * Tasks: T-CATALOG-003 (catalog preview), T-LIB-004 (continue list).
 *
 * Behavior (J-1/J-2): anonymous → catalog preview; authenticated →
 * "Continue reading" (≤ 20, most recent first) above the preview.
 * No feature code in this phase.
 *
 * Task: T-FOUND-003. API_CONTRACT §5: the bare `/` route is not a row of
 * its own — it composes the catalog preview (features/catalog, §5 row 1)
 * with continue-reading (features/library + features/progress, §2.3/§2.4).
 *
 * Metadata contract: this route is the one that uses the root layout's
 * `default` title ("Yomi") — naming it "Home · Yomi" would put the word
 * "Home" in a tab bar next to the product name. It states the title
 * explicitly rather than relying on the default so the route map's titles
 * are all visible in this file. Note that Next applies `title.template`
 * only to CHILD segments, so this page (in the root segment, like the
 * layout) is not suffixed; every other route in the map is.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yomi',
};

export default function HomePage() {
  return (
    <>
      <h1>Yomi</h1>
      <p className="note">
        A reading room for the manga and comics you own or are licensed to read.
      </p>
      {/* TODO(T-LIB-004): continue-reading section (authenticated) */}
      {/* TODO(T-CATALOG-003): catalog preview grid (all users) */}
    </>
  );
}
