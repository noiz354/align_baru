'use client';

/**
 * CatalogControls — the genre, status and sort controls (T-CATALOG-004/005).
 *
 * Requirements: FR-CATALOG-002/003/004, NFR-A11Y-002, NFR-A11Y-004,
 * NFR-A11Y-010. Tasks: T-CATALOG-004, T-CATALOG-005.
 * Spec: TASKS.md T-CATALOG-004 expected behaviors 1–2, T-CATALOG-005
 * expected behavior 1; ACCESSIBILITY.md §2 (filters in an `aside`, every input
 * with a visible label), §3.3.
 *
 * ── URL-driven, and the URL is the only state ──────────────────────────────
 * Every control writes to the query string and the server re-reads it. No
 * `useState` copy of the view exists, so there is no second source of truth to
 * fall out of step with the address bar, and a pasted URL renders the same
 * shelf this component would have produced.
 *
 * ── Keyboard, natively wherever the platform already does it ───────────────
 *   - The chips are real `<button type="button">`s with `aria-pressed`, so
 *     Enter and Space toggle them with no key handling at all (T-CATALOG-004
 *     expected behavior 2). A checkbox would have given Space for free and
 *     Enter not at all; a link would have given Enter and not Space.
 *   - `Escape` clears every genre, and only when focus is inside the genre
 *     group. A document-level Escape would hijack the key from the reader's own
 *     shortcuts; scoping it to the group is the version that can be explained
 *     in a sentence.
 *   - The selects are native `<select>`s, so the platform's own keyboard
 *     handling applies (type-ahead, arrows, Home/End).
 * - Every target is at least 44×44 (`--target-min`), including the chips:
 *   the hi-fi set drew them at 36 px, and NFR-A11Y-010 overrules that.
 *
 * ── The five-genre ceiling is the contract's, and it is visible ────────────
 * API_CONTRACT §2.1 caps `genre?` at 5 slugs. Selecting a sixth would earn a
 * 422 and a broken page, so the sixth is refused with a sentence that says why
 * — and the cap is declared in the group's own description, so it is not a
 * surprise discovered by trying.
 *
 * ── Known limitation, stated rather than hidden ────────────────────────────
 * The controls need JavaScript, so a visitor with scripting off sees page 1 of
 * the catalog and controls that do nothing. The half that matters — the grid,
 * every card, every link, the 404 page — is server-rendered and works either
 * way (T-CATALOG-003 expected behavior 1). A `<form method="get">` would make
 * the selects work without scripting, at the cost of an "Apply" button that
 * most readers would never need; that trade is a task's decision, not a
 * side-effect of this one.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { MangaStatus } from '../../shared/contracts';
import { Button } from '../../shared/ui/Button';
import {
  catalogHref,
  MANGA_STATUSES,
  MAX_GENRES,
  SORT_LABEL,
  STATUS_LABEL,
  type CatalogSort,
  type CatalogView,
} from './catalog-query';
import type { GenreFacet } from './catalog-schema';
import styles from './discover.module.css';

export type CatalogControlsProps = {
  view: CatalogView;
  /** The genre vocabulary; empty when the facets call failed. */
  genres: readonly GenreFacet[];
  /** True when the vocabulary could not be read, so the filter says so. */
  genresUnavailable: boolean;
};

const SORT_ORDER: readonly CatalogSort[] = ['updated_desc', 'title_asc', 'added_desc'];

export function CatalogControls({
  view,
  genres,
  genresUnavailable,
}: CatalogControlsProps) {
  const router = useRouter();
  // The cap message is state because it is a consequence of an ACTION, not of
  // the URL: the URL never contains a refused selection.
  const [capNotice, setCapNotice] = useState<string | null>(null);

  const go = useCallback(
    (next: CatalogView) => {
      // scroll: false — a filter change is not a new page. Jumping the reader
      // back to the top because they unticked "Drama" is the kind of small
      // rudeness that makes a filter feel hostile.
      router.push(catalogHref(next), { scroll: false });
    },
    [router],
  );

  const toggleGenre = useCallback(
    (slug: string) => {
      setCapNotice(null);
      const selected = view.genres.includes(slug);
      if (!selected && view.genres.length >= MAX_GENRES) {
        setCapNotice(
          `Choose up to ${MAX_GENRES} genres. Clear one first to add another.`,
        );
        return;
      }
      go({
        ...view,
        genres: selected
          ? view.genres.filter((value) => value !== slug)
          : [...view.genres, slug],
      });
    },
    [go, view],
  );

  const clearGenres = useCallback(() => {
    if (view.genres.length === 0) return;
    setCapNotice(null);
    go({ ...view, genres: [] });
  }, [go, view]);

  const clearAll = useCallback(() => {
    setCapNotice(null);
    go({ genres: [], status: null, sort: 'updated_desc' });
  }, [go]);

  const hasFilters = view.genres.length > 0 || view.status !== null;
  const genreSummary = `Togglable genre filters. Choose up to ${MAX_GENRES}. Escape clears every genre.`;

  return (
    <div className={styles.filtersBody}>
      <div className={styles.field}>
        <p className={styles.filterNote} id="catalog-genre-hint">
          {genreSummary}
        </p>
        {/*
          The group IS the scroll container for more than twenty genres
          (T-CATALOG-004), so the key handler lives on it: Escape works from
          any chip and from nowhere else on the page.
        */}
        {genresUnavailable ? (
          <p className={styles.filterNote} role="status">
            The genre list could not be loaded, so filtering by genre is unavailable. Status and
            sort still work.
          </p>
        ) : (
          <div
            className={styles.genres}
            role="group"
            aria-label="Genres"
            aria-describedby="catalog-genre-hint"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                clearGenres();
              }
            }}
          >
            {genres.map((genre) => (
              <button
                key={genre.slug}
                type="button"
                className={styles.chip}
                aria-pressed={view.genres.includes(genre.slug)}
                onClick={() => toggleGenre(genre.slug)}
              >
                {genre.name}
              </button>
            ))}
          </div>
        )}
        {capNotice === null ? null : (
          <p className={styles.filterNote} role="status">
            {capNotice}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="catalog-status">Status</label>
        <select
          id="catalog-status"
          name="status"
          value={view.status ?? ''}
          onChange={(event) => {
            const next = event.target.value;
            go({
              ...view,
              status: next === '' ? null : (next as MangaStatus),
            });
          }}
        >
          <option value="">Any status</option>
          {MANGA_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="catalog-sort">Sort</label>
        <select
          id="catalog-sort"
          name="sort"
          value={view.sort}
          onChange={(event) => {
            go({ ...view, sort: event.target.value as CatalogSort });
          }}
        >
          {SORT_ORDER.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABEL[sort]}
            </option>
          ))}
        </select>
      </div>

      {hasFilters ? (
        <div className={styles.filterActions}>
          <Button onClick={clearAll}>Clear filters</Button>
        </div>
      ) : null}
    </div>
  );
}

export default CatalogControls;
