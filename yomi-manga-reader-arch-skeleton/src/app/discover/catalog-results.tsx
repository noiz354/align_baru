'use client';

/**
 * CatalogResults — the count, the grid, the empty state and "load more".
 *
 * Requirements: FR-CATALOG-001/005, NFR-A11Y-004, NFR-PERF-003/008.
 * Tasks: T-CATALOG-003 (grid + cursor pagination), T-CATALOG-005 (announced
 * result count), T-CATALOG-003 edge cases (empty catalog).
 *
 * ── Why the grid is a client component at all ──────────────────────────────
 * Because of ONE reason: an opaque cursor. `nextCursor` is a token the catalog
 * API issues and the UI cannot compute, construct or reproduce, so the next page
 * cannot be reached by a link — only by a read that presents the token. Page 1
 * still arrives as server-rendered HTML, because a client component is rendered
 * on the server too: the LCP cover and all 24 cards are in the first response,
 * and this island only takes over for the append.
 *
 * ── The cursor is deliberately NOT in the URL ──────────────────────────────
 * An opaque cursor is not shareable state. Pasting `?cursor=eyJvZmZzZXQiOjI0fQ`
 * into a message would show a reader "page 2 of their filters" rather than
 * "their page 1 plus page 2", and it would be a bookmark that decays the moment
 * an admin publishes a title. Keeping it out means a reload is page 1
 * (E2E-CATALOG-002's "page 1 → 2 → back"), and it makes T-CATALOG-005's rule —
 * "a sort change resets the cursor to page 1" — true BY CONSTRUCTION rather
 * than by a reset: every change of view re-renders from the server, and the
 * server only ever asks for page 1.
 *
 * The consequence for this component: its state must not survive a change of
 * view, and the page gives it a `key` of the view's href so a new shelf mounts
 * a fresh island. No effect, no stale window where the old cursor is offered for
 * the new filters.
 *
 * ── The count is a live region that is always in the DOM ──────────────────
 * T-CATALOG-005 expected behavior 2 asks for a polite announcement of the
 * result count. An element that is ADDED to announce does not announce: a live
 * region has to exist first and then change. So this line is rendered on every
 * state — populated, empty, appended, filtered — and only its text changes.
 * `aria-atomic` makes the whole sentence read rather than the difference between
 * two numbers.
 *
 * The count never invents a total: the contract exposes no total, only a cursor,
 * so it reports what is on screen and whether more exists.
 */
import { useCallback, useState } from 'react';
import type { MangaSummary } from '../../shared/contracts';
import { Button } from '../../shared/ui/Button';
import { UiLink } from '../../shared/ui/Link';
import { catalogApiQuery, type CatalogView } from './catalog-query';
import { catalogPageSchema } from './catalog-schema';
import { MangaCard } from './manga-card';
import styles from './discover.module.css';

export type CatalogResultsProps = {
  /** Page 1, rendered by the server. */
  items: readonly MangaSummary[];
  /** The opaque token for page 2, or null when the shelf is exhausted. */
  nextCursor: string | null;
  view: CatalogView;
  limit: number;
};

export function CatalogResults({ items, nextCursor, view, limit }: CatalogResultsProps) {
  const [appended, setAppended] = useState<readonly MangaSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const loadMore = useCallback(() => {
    // The `loading` guard is the double-submit guard: without it, a reader who
    // taps the button twice appends the same page twice.
    if (cursor === null || loading) return;
    setLoading(true);
    setFailure(null);

    void (async () => {
      try {
        const response = await fetch(catalogApiQuery(view, { limit, cursor }), {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          setFailure('The next page could not be loaded. The button below tries again.');
          return;
        }
        const parsed = catalogPageSchema.safeParse(await response.json());
        if (!parsed.success) {
          setFailure('The next page could not be read. The button below tries again.');
          return;
        }
        setAppended((current) => [...current, ...parsed.data.items]);
        setCursor(parsed.data.nextCursor);
      } catch {
        setFailure('The next page could not be loaded. The button below tries again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [cursor, loading, limit, view]);

  const all: readonly MangaSummary[] = [...items, ...appended];
  const count = all.length;
  const sentence =
    count === 0
      ? 'No titles match these filters.'
      : `${count} ${count === 1 ? 'title' : 'titles'}${
          cursor === null ? '' : ' so far — more available'
        }.`;

  return (
    <div>
      {/* Always present, so every change of shelf has a live region to speak
          into (see the header). */}
      <p className={styles.count} aria-live="polite" aria-atomic="true">
        {sentence}
      </p>

      {all.length === 0 ? (
        <div className={styles.state}>
          <h3>Nothing on this shelf</h3>
          <p>
            No published title matches the filters you picked. Clearing them shows the whole
            catalog. If the library is genuinely empty, an admin has to add and publish a title
            before it can appear here.
          </p>
          <UiLink className="btn" href="/discover">
            Clear the filters
          </UiLink>
        </div>
      ) : (
        <ul className={styles.grid} aria-label="Titles" aria-busy={loading || undefined}>
          {all.map((manga, index) => (
            <MangaCard key={manga.id} manga={manga} priority={index === 0} />
          ))}
        </ul>
      )}

      {failure === null ? null : (
        <p className={styles.filterNote} role="alert">
          {failure}
        </p>
      )}

      {cursor === null ? null : (
        <div className={styles.more}>
          <Button onClick={loadMore} disabled={loading} aria-busy={loading || undefined}>
            {loading ? 'Loading more titles…' : 'Load more titles'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default CatalogResults;
