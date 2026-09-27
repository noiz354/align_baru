/**
 * DetailUnavailable — the labelled state for "this title could not be read".
 *
 * Requirements: NFR-A11Y-003 (focusable and announced), NFR-SEC-010,
 * ACCESSIBILITY.md §6. Tasks: T-CATALOG-006.
 *
 * Deliberately NOT the 404 page. `notFound()` is reserved for a title that does
 * not exist, is unpublished, or is soft-deleted — the API's MANGA_NOT_FOUND,
 * which is also what keeps existence from leaking (THREAT T-04). An upstream
 * that refused or timed out is a different fact with a different remedy, and
 * showing "page not found" for it would tell a reader their bookmark is dead
 * when the title is fine.
 *
 * The copy is bounded for the same reason as the catalog's: the upstream status,
 * the request id and any storage detail stay on the server (NFR-SEC-010).
 * Retry is a real link to this title's own address, so it works without
 * scripting and behaves like every other link on the page.
 */
import { classNames } from '../../../shared/ui/classNames';
import { FocusRegion } from '../../../shared/ui/FocusRegion';
import { UiLink } from '../../../shared/ui/Link';
import styles from './manga-detail.module.css';

export type DetailUnavailableProps = {
  labelledBy: string;
  retryHref: string;
};

export function DetailUnavailable({ labelledBy, retryHref }: DetailUnavailableProps) {
  return (
    <FocusRegion labelledBy={labelledBy} className={classNames(styles.state)}>
      <h1 id={labelledBy}>This title could not be loaded</h1>
      <p>
        <strong>Cause.</strong> The details could not be read just now. The title has not been
        removed, and your place in it is untouched.
      </p>
      <p>
        <strong>What you can do.</strong> Try again in a moment, or go back to the catalog and
        find the title again.
      </p>
      <p className={styles.actions}>
        <UiLink className="btn btn--primary" href={retryHref}>
          Try again
        </UiLink>
        <UiLink className="btn" href="/discover">
          Back to the catalog
        </UiLink>
      </p>
    </FocusRegion>
  );
}

export default DetailUnavailable;
