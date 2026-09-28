import 'server-only';

/**
 * Library (`/library`) — the member's shelf, read live.
 *
 * Requirements: FR-LIBRARY-003 (the grid, the unread badge, the last-read
 * position), FR-LIBRARY-004 (the sort), FR-LIBRARY-006, NFR-A11Y-004
 * (landmarks and structure), NFR-A11Y-002 (a control a reader can drive),
 * NFR-A11Y-003, NFR-SEC-010, NFR-PERF-003.
 * Tasks: T-LIB-003 (this page and its island), T-LIB-002 (the list API it
 * consumes), T-LIB-001 (the service behind that API), T-LIB-007 /
 * T-READER-025 (the two other member routes, which now share the read helpers).
 * Spec: shared/contracts/library.ts (`LibraryEntry`, `LibrarySort`),
 * DATA_MODEL §11, API_CONTRACT §2.4, ACCESSIBILITY.md §2/§3.3/§6.
 *
 * ── The feed this page consumes, and what is in it ──────────────────────────
 * `GET /api/library` (src/app/api/library/route.ts) answers
 * `{ items: LibraryEntry[], nextCursor }`, and a `LibraryEntry` is
 * `{ manga, addedAt, lastRead, unreadChapterCount, unavailable }`. So the title,
 * the cover and the slug come from the DTO rather than from a second read, the
 * badge is `unreadChapterCount`, "Ch. 12 · p. 45" is `lastRead`, and the shelf
 * paginates on `nextCursor`. The page used to join the shelf against the
 * published catalog feed to recover a title, and used to say on the page that a
 * reading position and an unread count were not available; both are gone, and
 * the workaround that made them necessary is gone with them.
 *
 * Statuses this page has to tell apart: 401 (no session — the signed-out state),
 * 200 (the shelf, which may legitimately be empty), 422 `CATALOG_PAGE_INVALID`
 * (a cursor this list cannot read — treated as the page's own retryable state,
 * because this page only ever asks for page 1 and never sends a cursor), and
 * anything else (refused, timed out, unparseable — one "try again" state).
 *
 * ── Why the read goes out over HTTP, like /discover ─────────────────────────
 * The UI lane owns no database (D6, dependency-rules §1). So this page reads the
 * route a browser would and imports nothing from `server/*` and nothing from
 * `features/*`. Same seam, same reason, same absence of SQL.
 *
 * ── The session cookie has to be replayed, and this is the subtle part ─────
 * `resolveCaller` (src/app/api/_runtime.ts) answers null without a
 * `session_token` cookie and the route answers 401. A React Server Component's
 * `fetch` does NOT forward the browser's cookies, so the incoming `cookie`
 * header is read from `headers()` and replayed onto the read — in
 * `_members/member-api.ts`, which is the one place that happens for all three
 * personal pages. Without it this page would render its signed-out state for a
 * reader who IS signed in — a fault indistinguishable from a session bug.
 *
 * ── `userId` never appears, in either direction ─────────────────────────────
 * No DTO in shared/contracts/library.ts carries one (THREAT T-04: these shapes
 * are scoped to the CALLING user), and this page sends none: the owner is the
 * session the route resolves, never a parameter.
 *
 * ── Why the sort lives in the URL and is sent to the API ───────────────────
 * The route takes `sort` (and `cursor`, and `limit`), so the shelf is SORTED BY
 * THE ROUTE rather than re-sorted here — the ordering a reader sees is the
 * ordering the database produced, cursor and all. The chosen sort still lives in
 * the query string, so the address bar holds the view, a reload keeps it and
 * `Back` works (T-CATALOG-004/005's rule). The control is a plain
 * `<form method="get">` with a native `<select>`, so it works with scripting
 * off; the sort changes no rows client-side, so there is no island for it.
 *
 * ── The two `force-dynamic` reasons (both real) ────────────────────────────
 *   1. PERFORMANCE.md §7 — the shelf is member data, `no-store`.
 *   2. The sort lives in the query string, so `/library` and
 *      `/library?sort=title_asc` are different documents.
 *
 * ── A11y notes, since T-LIB-003 asks for a keyboard-navigable grid ─────────
 *   - Heading order: the page owns the h1, the shelf region owns its h2, and
 *     nothing below them is a heading that a screen reader has to re-enter.
 *   - The count is a live region that is ALWAYS in the document, so a change of
 *     sort has a region to announce into (an element added to announce, does not).
 *   - The shelf is a real `ul`/`li` of links, so Tab walks it in visual order;
 *     the island's header says why there is no arrow-key roving grid.
 *   - Nothing on this page is carried by colour alone (ACCESSIBILITY.md §3.3):
 *     the unread badge is icon + count + word, an unopenable title is the WORD
 *     "Unavailable" with no link at all, and a missing cover is a word.
 *   - Every cover is `alt=""` inside a link named by its title text, and every
 *     cover box is reserved by `aspect-ratio` so nothing shifts as images land.
 */
import type { Metadata } from 'next';
import type { LibrarySort } from '../../shared/contracts';
import { StateRegion } from '../../shared/ui/StateRegion';
import { readMembers } from '../_members/member-api';
import { libraryPageSchema } from '../_members/member-schema';
import { LibraryShelf } from './library-shelf';

export const metadata: Metadata = {
  title: 'Library',
  description: 'The titles on your shelf, with covers and when you last opened each one.',
};

/** Member data: never prerendered, never cached (PERFORMANCE.md §7). */
export const dynamic = 'force-dynamic';

/**
 * How many entries this page asks for.
 *
 * 24 is the same page size the catalog grid uses, for the same reason: a screen
 * of covers is a screen, and the route's own cap is 48 (API_CONTRACT §2.4). The
 * rest of a large shelf arrives through the island's "load more", which presents
 * the opaque `nextCursor` the page cannot construct.
 */
const SHELF_PAGE_SIZE = 24;

/* ── the view: the sort, and only the sort ────────────────────────────────── */

const LIBRARY_SORTS = [
  'last_read_desc',
  'added_desc',
  'title_asc',
] as const satisfies readonly LibrarySort[];

const SORT_LABEL: Readonly<Record<LibrarySort, string>> = {
  last_read_desc: 'Recently read first',
  added_desc: 'Newly added first',
  title_asc: 'Title A–Z',
};

const SORT_SENTENCE: Readonly<Record<LibrarySort, string>> = {
  last_read_desc: 'most recently read first',
  added_desc: 'newest first',
  title_asc: 'in title order',
};

/** `searchParams` is a promise in Next 16, and a key may arrive as an array. */
type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/**
 * Total, like `parseCatalogView`: the query string is attacker-controlled, so an
 * unknown sort is DROPPED and the contract's default is used rather than
 * forwarded (SECURITY T-02 — an unknown value is a sort the route would not
 * recognise, and this page would render a shelf nobody asked for).
 */
function parseSort(params: SearchParams): LibrarySort {
  const raw = single(params['sort']);
  return (LIBRARY_SORTS as readonly string[]).includes(raw)
    ? (raw as LibrarySort)
    : 'last_read_desc';
}

/** The wire query for one page of the shelf, in the view's sort. */
function shelfQuery(sort: LibrarySort): string {
  const query = new URLSearchParams({ sort, limit: String(SHELF_PAGE_SIZE) });
  return `/api/library?${query.toString()}`;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const view = parseSort(await searchParams);

  const shelf = await readMembers(shelfQuery(view), libraryPageSchema);

  if (!shelf.ok) {
    return <LibraryShell signedOut={shelf.failure === 'signed-out'} unavailableHref="/library" />;
  }

  if (shelf.data.items.length === 0) {
    // An empty shelf is a real answer and not a fault, so it is its own state
    // with a route out of it — the catalog (ACCESSIBILITY.md §6). The page only
    // ever asks for page 1, so "no items" here is "no shelf", not "page 1 of
    // an empty page 2".
    return (
      <>
        <h1>Library</h1>
        <StateRegion
          headingId="library-empty"
          headingLevel={2}
          title="Your library is empty"
          cause="Nothing is on your shelf yet. You add a title by opening it from the catalog and choosing to keep it — no account was created for you in the meantime, and nothing has been lost."
          remedy="Browse the catalog and open a title to put it on your shelf."
          actions={[
            { href: '/discover', label: 'Browse the catalog', primary: true },
            { href: '/history', label: 'See what you have read' },
          ]}
        />
      </>
    );
  }

  return (
    <>
      <h1>Library</h1>

      <section aria-labelledby="library-shelf-h">
        <h2 id="library-shelf-h">Your shelf</h2>

        {/*
          A plain GET form: the native <select> is keyboard-operable by the
          platform (arrows, type-ahead, Home/End) and the whole control works
          with scripting off, which is why the sort has no island.
        */}
        <form className="page-actions" method="get" action="/library">
          <div className="field">
            <label htmlFor="library-sort">Sort</label>
            <select id="library-sort" name="sort" defaultValue={view}>
              {LIBRARY_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {SORT_LABEL[sort]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn">
            Apply
          </button>
        </form>

        <LibraryShelf
          items={shelf.data.items}
          nextCursor={shelf.data.nextCursor}
          sort={view}
          limit={SHELF_PAGE_SIZE}
          sortSentence={SORT_SENTENCE[view]}
        />
      </section>
    </>
  );
}

/**
 * The two states a shelf that cannot be read needs. A 401 and a broken read are
 * different sentences for a reader: one is "you are not signed in" and offers
 * sign-in, the other is "try again" and offers the page itself. Both are focusable
 * and announced (NFR-A11Y-003), and neither says anything about upstream status
 * codes or connection details (NFR-SEC-010).
 */
function LibraryShell({
  signedOut = false,
  unavailableHref,
}: {
  signedOut?: boolean;
  unavailableHref: string;
}) {
  return (
    <>
      <h1>Library</h1>
      {signedOut ? (
        <StateRegion
          headingId="library-signed-out"
          headingLevel={2}
          title="Your library is only yours when you are signed in"
          cause="This page shows one reader's shelf, so it needs a session before it can read anything. Nothing was lost — the shelf is waiting."
          remedy="Sign in and this page will show your titles."
          actions={[
            { href: '/auth/signin?next=/library', label: 'Sign in', primary: true },
            { href: '/discover', label: 'Browse the catalog' },
          ]}
        />
      ) : (
        <StateRegion
          headingId="library-unavailable"
          headingLevel={2}
          title="Your library is unavailable"
          cause="The shelf could not be read just now. Nothing has been removed, and your reading history and bookmarks are untouched."
          remedy="Try again in a moment. A title you were reading is still reachable by its address."
          actions={[
            { href: unavailableHref, label: 'Try again', primary: true },
            { href: '/discover', label: 'Browse the catalog' },
          ]}
        />
      )}
    </>
  );
}
