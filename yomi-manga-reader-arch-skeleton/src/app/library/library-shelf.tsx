'use client';

/**
 * LibraryShelf — the grid, the announced count, and "load more".
 *
 * Requirements: FR-LIBRARY-003 (the grid, the unread badge, the last-read
 * position), FR-LIBRARY-004 (the sort), FR-LIBRARY-006 (the shelf is the
 * reader's own), NFR-A11Y-004 (landmarks and structure), NFR-A11Y-003,
 * NFR-PERF-003 (reserved image boxes), NFR-SEC-010.
 * Tasks: T-LIB-003 (this island and its page), T-LIB-002 (the feed it reads).
 * Spec: shared/contracts/library.ts `LibraryEntry`, API_CONTRACT §2.4,
 * ACCESSIBILITY.md §2/§3.3/§6.
 *
 * ── Why this is a client island at all ──────────────────────────────────────
 * Because of ONE reason: an opaque cursor. `nextCursor` is a token the shelf API
 * issues and the UI cannot compute, construct or reproduce, so the next page
 * cannot be reached by a link — only by a read that presents the token. Page 1
 * is still server-rendered HTML (a client component renders on the server too),
 * so the covers and all their text are in the first response; this island only
 * takes over for the append. It is the same arrangement, for the same reason, as
 * `discover/catalog-results.tsx`.
 *
 * ── The cursor is deliberately NOT in the URL ───────────────────────────────
 * Pasting `?cursor=…` into a message would show a reader "page 2 of their
 * shelf" rather than "their shelf", and it is a bookmark that decays the moment
 * anything on it is read again. Keeping it out means a reload is page 1, and it
 * makes "a sort change starts again at page 1" true BY CONSTRUCTION: the page
 * re-renders from the server, and the server only ever asks for page 1. The
 * sort — which IS reader-chosen state — stays in the query string.
 *
 * ── What is on a tile, and where each piece comes from ──────────────────────
 * cover, title, status and latest chapter are `entry.manga`; "Ch. 12 · p. 45"
 * and its date are `entry.lastRead`; the badge is `entry.unreadChapterCount`;
 * the unopenable state is `entry.unavailable`. All of it is the `LibraryEntry`
 * the route returns — the shelf no longer has to be joined against the
 * published catalog to learn a title, and a title on the shelf that is not in
 * the catalog any more is no longer a mystery (EC-ADM-02).
 *
 * ── Nothing here is carried by colour alone (ACCESSIBILITY.md §3.3) ─────────
 *   - the unread badge says the number AND the word, with the dot decorative;
 *   - an entry that cannot be opened says "Unavailable" in a dashed chip and has
 *     no link at all, so the state is visible and the affordance is absent;
 *   - a missing or failed cover says "No cover" as a word;
 *   - a title added but never opened says "Not opened yet".
 *
 * ── Keyboard (T-LIB-003 expected behavior 3) ───────────────────────────────
 * The shelf is a real `ul`/`li` of links, so Tab walks it in visual order. No
 * arrow-key roving grid is added: without one, arrow keys are the browser's
 * scroll, and a grid that hijacks them is a regression for the readers who need
 * the scroll.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LibraryEntry, LibrarySort } from '../../shared/contracts';
import { Button } from '../../shared/ui/Button';
import { UiLink } from '../../shared/ui/Link';
import { libraryPageSchema } from '../_members/member-schema';

export type LibraryShelfProps = {
  /** Page 1, rendered by the server. */
  items: readonly LibraryEntry[];
  /** The opaque token for page 2, or null when the shelf is exhausted. */
  nextCursor: string | null;
  /** The sort the server was asked for; the append must ask for the same one. */
  sort: LibrarySort;
  /** The page size the server was asked for, so both reads agree on it. */
  limit: number;
  /** How the current sort reads in a sentence, so the island states it too. */
  sortSentence: string;
};

const STATUS_LABEL = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  hiatus: 'Hiatus',
} as const;

/** Milliseconds for a `<time>` value, or null when it is absent or unusable. */
function timeOf(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined) return null;
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? null : value;
}

/**
 * `YYYY-MM-DD` for a `<time>` element — the convention `manga/[slug]` and the
 * sibling personal pages use. A shelf is scanned as a column, so a fixed-width
 * UTC date beats a relative phrase, which also goes stale the moment a page sits
 * in a cache.
 */
function formatDate(iso: string | null | undefined): string {
  const value = timeOf(iso);
  return value === null ? '' : new Date(value).toISOString().slice(0, 10);
}

/** The reader's position in a chapter, as TASKS.md T-LIB-003 words it. */
function positionLabel(lastRead: LibraryEntry['lastRead']): string {
  return lastRead === null
    ? 'Not opened yet'
    : `Ch. ${lastRead.chapterNumber} · p. ${lastRead.pageNumber}`;
}

/* ── presentation ──────────────────────────────────────────────────────────── */

/*
 * The tokens are still the only place a colour, a size or a duration is written
 * (T-FOUND-004). These are inline because a stylesheet is not in this task's
 * write scope, and borrowing `discover.module.css` would couple the members'
 * shelf to the catalog lane's private class names. Every value below is a
 * `var(--token)`; none is a literal.
 */
const SHELF: CSSProperties = {
  display: 'grid',
  gap: 'var(--sp-5) var(--sp-4)',
  gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const TILE: CSSProperties = {
  minWidth: 0,
  display: 'grid',
  gap: 'var(--sp-2)',
  alignContent: 'start',
};

const TILE_LINK: CSSProperties = {
  display: 'grid',
  gap: 'var(--sp-2)',
  alignContent: 'start',
  minWidth: 0,
  textDecoration: 'none',
  color: 'inherit',
  borderRadius: 'var(--r-md)',
};

const TILE_TITLE: CSSProperties = {
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  lineHeight: 'var(--lh-snug)',
  color: 'var(--ink-primary)',
  overflowWrap: 'anywhere',
  textWrap: 'pretty',
};

const TILE_META: CSSProperties = {
  fontSize: 'var(--fs-sm)',
  lineHeight: 'var(--lh-snug)',
  color: 'var(--ink-muted)',
  overflowWrap: 'anywhere',
};

const TILE_ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--sp-2)',
  minWidth: 0,
};

/**
 * The unread badge: icon + count + the word, in a chip whose ink, wash and edge
 * all come from the quiet-accent trio. The number and the word are the meaning;
 * the dot and the colour are decoration on top of it (T-LIB-003 expected
 * behavior 2 — never colour alone).
 */
const BADGE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--sp-1)',
  padding: '0 var(--sp-2)',
  borderRadius: 'var(--r-pill)',
  border: '1px solid var(--accent-quiet-edge)',
  background: 'var(--accent-quiet-bg)',
  color: 'var(--accent-quiet-ink)',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  letterSpacing: 'var(--tracking-caps)',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

/** The badge's icon: a shape, not a character, and `currentColor` so it cannot drift. */
const BADGE_DOT: CSSProperties = {
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: 'var(--r-pill)',
  background: 'currentColor',
};

/**
 * The unopenable state, in words plus a shape that survives a monochrome
 * rendering or a stylesheet that never loads (ACCESSIBILITY.md §3.3).
 */
const UNAVAILABLE_CHIP: CSSProperties = {
  ...TILE_META,
  fontWeight: 600,
  letterSpacing: 'var(--tracking-caps)',
  textTransform: 'uppercase',
  border: '1px dashed var(--line-control)',
  borderRadius: 'var(--r-pill)',
  padding: '0 var(--sp-2)',
};

/**
 * The cover box is reserved by `aspect-ratio`, not by the image having loaded, so
 * a missing cover, a 404 cover and a loaded cover all occupy the same geometry
 * (NFR-PERF-003). The `width`/`height` attributes on the <img> reserve the same
 * box before this stylesheet arrives.
 */
const COVER_BOX: CSSProperties = {
  position: 'relative',
  display: 'block',
  width: '100%',
  aspectRatio: '2 / 3',
  borderRadius: 'var(--r-sm)',
  background: 'var(--bg-sunken)',
  overflow: 'hidden',
  // An outline, not a border: it does not change the box the aspect ratio
  // computed, so it can never be the cause of a shift.
  outline: '1px solid var(--line-hairline)',
  outlineOffset: '-1px',
};

const COVER_IMG: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

/** The no-artwork state is a WORD, inside an aria-hidden box (discover's rule). */
const COVER_EMPTY: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 'var(--sp-2)',
  textAlign: 'center',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  letterSpacing: 'var(--tracking-caps)',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
  outline: '1px dashed var(--line-hairline)',
  outlineOffset: 'var(--sp-4)',
};

const MORE: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  paddingBlock: 'var(--sp-5)',
};

/**
 * One cover, or the word that says there is none.
 *
 * The failure is handled here rather than by the parent because a cover that
 * 404s is a per-tile fact: the media route answers 404 for a soft-deleted
 * title's asset (EC-ADM-02), and a broken-image icon in a reserved box reads as
 * a product fault rather than a missing object.
 */
function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement | null>(null);

  // A cover that fails BEFORE hydration never fires React's `onError`: the
  // handler does not exist yet, and the browser does not replay the event. The
  // media route answers a missing asset in about two milliseconds, which is
  // faster than hydration, so `onError` alone is not a fallback — it is the
  // other half. `complete && naturalWidth === 0` is the browser's own answer to
  // "this did not load", and asking it once the element is in the DOM covers
  // both orders without guessing which one happened.
  useEffect(() => {
    const node = img.current;
    if (node !== null && node.complete && node.naturalWidth === 0) setFailed(true);
  }, [src]);

  return (
    <span style={COVER_BOX}>
      {src === null || failed ? (
        // aria-hidden: the word is for a sighted reader, and the title beside
        // the box already names the tile for everyone else.
        <span aria-hidden="true" style={COVER_EMPTY}>
          No cover
        </span>
      ) : (
        // `alt=""` on purpose: the link's accessible name is the title text
        // beside it, so an alt duplicating the title would make the name read
        // twice. A decorative image in a named link is the correct markup.
        <img
          ref={img}
          src={src}
          alt=""
          width={600}
          height={900}
          loading="lazy"
          decoding="async"
          style={COVER_IMG}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function LibraryShelf({ items, nextCursor, sort, limit, sortSentence }: LibraryShelfProps) {
  const [appended, setAppended] = useState<readonly LibraryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const loadMore = useCallback(() => {
    // The `loading` guard is the double-submit guard: without it, a reader who
    // taps twice appends the same page twice.
    if (cursor === null || loading) return;
    setLoading(true);
    setFailure(null);

    void (async () => {
      try {
        const query = new URLSearchParams({ sort, limit: String(limit), cursor });
        const response = await fetch(`/api/library?${query.toString()}`, {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          setFailure('The next page could not be loaded. The button below tries again.');
          return;
        }
        const parsed = libraryPageSchema.safeParse(await response.json());
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
  }, [cursor, limit, loading, sort]);

  const all: readonly LibraryEntry[] = [...items, ...appended];

  /*
   * The server's page 1 replaces whatever this island had accumulated.
   *
   * An appended page is only true of the page 1 it was fetched against, and a
   * server render — a Back, a refresh, a revalidation — hands this island a new
   * one. Adjusting the state DURING the render (React's documented pattern for
   * "a prop changed") is what keeps the stale rows out of the DOM, instead of
   * removing them a commit later.
   */
  const serverPage = items.map((entry) => entry.manga.id).join('|');
  const [renderedPage, setRenderedPage] = useState(serverPage);
  if (serverPage !== renderedPage) {
    setRenderedPage(serverPage);
    setAppended([]);
    setCursor(nextCursor);
  }

  const count = all.length;
  const countSentence = `${count} ${count === 1 ? 'title' : 'titles'} on your shelf, ${sortSentence}${
    cursor === null ? '.' : ' — more below.'
  }`;
  // A title that is still on the shelf but can no longer be opened (EC-ADM-02):
  // counted from what is on screen, because the page cannot know about pages the
  // reader has not loaded yet.
  const unavailable = all.filter((entry) => entry.unavailable).length;

  return (
    <div>
      {/* Always present, so a change of sort or a loaded page has a live region
          to speak into — an element that is ADDED to announce does not announce. */}
      <p className="note" aria-live="polite" aria-atomic="true">
        {countSentence}
      </p>

      <ul aria-label="Titles on your shelf" aria-busy={loading || undefined} style={SHELF}>
        {all.map((entry) => {
          const { manga } = entry;
          const added = formatDate(entry.addedAt);
          const read = formatDate(entry.lastRead?.at);
          const position = positionLabel(entry.lastRead);
          return (
            <li key={manga.id} style={TILE}>
              {entry.unavailable ? (
                // No link: the title is unpublished or soft-deleted and opening it
                // 404s (EC-ADM-02), so a link here would be a promise the route
                // cannot keep. The cover and the title still show — the entry is
                // the reader's and is not hidden from them.
                <>
                  <Cover src={manga.coverUrl} />
                  <span style={TILE_TITLE}>{manga.title}</span>
                  <span style={TILE_ROW}>
                    <span style={UNAVAILABLE_CHIP}>Unavailable</span>
                    <span style={TILE_META}>This title can no longer be opened</span>
                  </span>
                </>
              ) : (
                <UiLink href={`/manga/${manga.slug}`} prefetch={false} style={TILE_LINK}>
                  <Cover src={manga.coverUrl} />
                  <span style={TILE_TITLE}>{manga.title}</span>
                  <span style={TILE_META}>
                    {STATUS_LABEL[manga.status]}
                    {manga.latestChapter === null
                      ? ' · No chapters'
                      : ` · Latest Ch. ${manga.latestChapter.number}`}
                  </span>
                </UiLink>
              )}

              <span style={TILE_ROW}>
                {entry.unreadChapterCount > 0 ? (
                  <span style={BADGE}>
                    <span aria-hidden="true" style={BADGE_DOT} />
                    {entry.unreadChapterCount} unread
                  </span>
                ) : null}
                <span style={TILE_META}>{position}</span>
              </span>

              <span style={TILE_META}>
                {read === '' ? '' : `Read ${read}`}
                {added === '' ? '' : `${read === '' ? 'Added' : ' · added'} ${added}`}
              </span>
            </li>
          );
        })}
      </ul>

      {unavailable > 0 ? (
        <p className="note">
          {unavailable === 1
            ? 'One title on your shelf can no longer be opened:'
            : `${unavailable} titles on your shelf can no longer be opened:`}{' '}
          it went unpublished or was deleted after you added it. The entry stays on your shelf
          because the shelf is yours, and the chapters you have already read are untouched.
        </p>
      ) : null}

      {failure === null ? null : (
        <p className="note" role="alert">
          {failure}
        </p>
      )}

      {cursor === null ? null : (
        <div style={MORE}>
          <Button onClick={loadMore} disabled={loading} aria-busy={loading || undefined}>
            {loading ? 'Loading more titles…' : 'Load more titles'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default LibraryShelf;
