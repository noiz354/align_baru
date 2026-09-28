/**
 * CatalogUnavailable — the labelled state for "the catalog could not be read".
 *
 * Requirements: NFR-A11Y-003 (a state is focusable and announced), NFR-SEC-010 (nothing
 * about the internals reaches the reader), ACCESSIBILITY.md §6 ("never a blank main").
 * Tasks: T-CATALOG-003 (edge cases), T-CATALOG-006.
 *
 * ── Why this is a state and not a thrown error ─────────────────────────────
 * A page that cannot reach its own API is not a crash: the shell, the nav and the h1 are all
 * still true, and a reader who reloads may well get the shelf. So the read failure is a value
 * (see ./catalog-data) and this is what it renders.
 *
 * ── Why the retry is a link, not a button ───────────────────────────────────
 * The retry target is the page's OWN address, so it is a real href: it works with scripting
 * off, it is announced as navigation, and middle-click and open-in-new-tab behave the way a
 * reader expects. A `window.location.reload()` button would have been one more client island
 * for the same outcome.
 *
 * The shape itself — Cause, then what to do, then somewhere to go — lives in the shared
 * StateRegion, which not-found, error and the detail state also use, so a reader meets the
 * same grammar wherever the product has to admit something.
 *
 * What the reader is told is bounded on purpose: "the catalog is temporarily unavailable". The
 * upstream status, the request id and any storage detail stay on the server (NFR-SEC-010,
 * THREAT T-13) — a catalog 500 tells an attacker nothing useful and a reader nothing actionable.
 */
import { StateRegion } from '../../shared/ui/StateRegion';

export type CatalogUnavailableProps = {
  /** Id of the heading that names this region. */
  labelledBy: string;
  /** The page's own address: the honest retry target. */
  retryHref: string;
};

export function CatalogUnavailable({ labelledBy, retryHref }: CatalogUnavailableProps) {
  return (
    <StateRegion
      headingId={labelledBy}
      title="The catalog is unavailable"
      cause="The list of titles could not be read just now. Nothing has been removed, and the library itself is not lost."
      remedy="Try again in a moment. A title you were reading is still reachable by its address."
      actions={[
        { href: retryHref, label: 'Try again', primary: true },
        { href: '/', label: 'Go to the home page' },
      ]}
    />
  );
}

export default CatalogUnavailable;
