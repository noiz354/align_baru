/**
 * CatalogUnavailable — the labelled state for "the catalog could not be read".
 *
 * Requirements: NFR-A11Y-003 (a state is focusable and announced),
 * NFR-SEC-010 (nothing about the internals reaches the reader), ACCESSIBILITY.md
 * §6 ("never a blank main"). Tasks: T-CATALOG-003 (edge cases), T-CATALOG-006.
 *
 * ── Why this is a state and not a thrown error ─────────────────────────────
 * A page that cannot reach its own API is not a crash: the shell, the nav and
 * the h1 are all still true, and a reader who reloads may well get the shelf. So
 * the read failure is a value (see ./catalog-data) and this is what it renders:
 * cause, what to do, then somewhere to go — the shape not-found.tsx and
 * error.tsx already use, for the same reason (ACCESSIBILITY.md §6).
 *
 * Focus moves here on mount through the shared FocusRegion, because a keyboard
 * or screen-reader user must be told without hunting for it (NFR-A11Y-003). It
 * is deliberately not `role="alert"`: an assertive announcement of a whole
 * region, on a page that is otherwise fine, is an interruption rather than an
 * explanation. The focus move is the announcement.
 *
 * ── Why "Try again" is a link, not a button ────────────────────────────────
 * The retry target is the page's OWN address, so it is a real href: it works
 * with scripting off, it is announced as navigation, and middle-click and
 * open-in-new-tab behave the way a reader expects. A `window.location.reload()`
 * button would have been one more client island for the same outcome. It keeps
 * `.btn` for the 44×44 px floor and the two-band focus ring (NFR-A11Y-010) —
 * the same reason not-found.tsx uses it on links.
 *
 * What the reader is told is bounded on purpose: "the catalog is temporarily
 * unavailable". The upstream status, the request id and any storage detail stay
 * on the server (NFR-SEC-010, THREAT T-13) — a catalog 500 tells an attacker
 * nothing useful and a reader nothing actionable.
 */
import { classNames } from '../../shared/ui/classNames';
import { FocusRegion } from '../../shared/ui/FocusRegion';
import { UiLink } from '../../shared/ui/Link';
import styles from './discover.module.css';

export type CatalogUnavailableProps = {
  /** Id of the heading that names this region. */
  labelledBy: string;
  /** The page's own address: the honest retry target. */
  retryHref: string;
};

export function CatalogUnavailable({ labelledBy, retryHref }: CatalogUnavailableProps) {
  return (
    <FocusRegion labelledBy={labelledBy} className={classNames(styles.state)}>
      <h3 id={labelledBy}>The catalog is unavailable</h3>
      <p>
        <strong>Cause.</strong> The list of titles could not be read just now. Nothing has been
        removed, and the library itself is not lost.
      </p>
      <p>
        <strong>What you can do.</strong> Try again in a moment. A title you were reading is
        still reachable by its address.
      </p>
      <p className={styles.filterActions}>
        <UiLink className="btn btn--primary" href={retryHref}>
          Try again
        </UiLink>
        <UiLink className="btn" href="/">
          Go to the home page
        </UiLink>
      </p>
    </FocusRegion>
  );
}

export default CatalogUnavailable;
