import 'server-only';

/**
 * History (`/history`) — the reading sessions, newest first, read live.
 *
 * Requirements: FR-LIBRARY-008 (the history list), FR-READER-015 (a session is
 * one contiguous stretch of reading), DATA_MODEL §13, NFR-DATA-005 (a deleted
 * chapter keeps its row), NFR-DATA-006 (UTC stored), NFR-A11Y-003/004,
 * NFR-SEC-010.
 * Tasks: T-LIB-005 (this page and its island), T-READER-025 (the list API it
 * consumes, and the recording that fills it).
 * Spec: shared/contracts/library.ts `HistoryEntry`, API_CONTRACT §2.3,
 * ACCESSIBILITY.md §2/§3.3/§6.
 *
 * ── What changed: the route exists ─────────────────────────────────────────
 * This page used to be a shell that named `T-READER-025` as its blocker and
 * said so to the reader. `GET /api/history` (src/app/api/history/route.ts) now
 * exists, goes through the composition seam like the other two members' routes,
 * and answers `{ items: HistoryEntry[], nextCursor }` — so this is a real page
 * with a real list, not a promise with a heading.
 *
 * Statuses this page has to tell apart: 401 (no session — the signed-out
 * state), 200 (the history, which may legitimately be empty), 422
 * `CATALOG_PAGE_INVALID` (a cursor this list cannot read — this page only ever
 * asks for page one, so a bad cursor is a "try again", not a 422 rendered as a
 * list), and anything else (refused, timed out, unparseable — one retryable
 * state).
 *
 * ── Why the read goes out over HTTP, like /discover ─────────────────────────
 * The UI lane owns no database (D6, dependency-rules §1). This page reads the
 * route a browser would and imports nothing from `server/*` or `features/*`.
 * Same seam, same reason, no SQL.
 *
 * ── The session cookie has to be replayed ──────────────────────────────────
 * `resolveCaller` (src/app/api/_runtime.ts) answers null without a
 * `session_token` cookie and the route answers 401. A React Server Component's
 * `fetch` does NOT forward the browser's cookies, so the incoming `cookie`
 * header is read from `headers()` and replayed — in `_members/member-api.ts`,
 * the one place that happens for all three personal pages. Without that line
 * this page would render its signed-out state for a reader who IS signed in — a
 * fault that looks exactly like a session bug.
 *
 * ── What is on a row ───────────────────────────────────────────────────────
 * The manga title and the chapter number are `entry.chapter`; how far the reader
 * got is `entry.deepestPage`; when is `entry.startedAt`; how long the stretch
 * ran is `entry.durationMs`, with `endedAt: null` as an OPEN session that is
 * named rather than hidden. `chapter: null` renders "Unavailable chapter" in
 * words and the row is RETAINED (DATA_MODEL §13, NFR-DATA-005, T-LIB-005
 * expected behavior 1).
 *
 * ── Why the cursor is a button and not a link ──────────────────────────────
 * `nextCursor` is an opaque token this page cannot construct, so older sessions
 * are reachable only by a read that presents it — which is what the island's
 * "load older sessions" does. It is deliberately kept out of the URL for the
 * reason `discover` gives: a pasted cursor is a bookmark that decays.
 *
 * ── A11y notes ─────────────────────────────────────────────────────────────
 *   - Heading order: the page owns the h1, the region owns its h2, and the
 *     count is a live region that is always in the document.
 *   - The list is a real `ul`/`li`, named, newest first.
 *   - "Unavailable chapter" is a WORD, never a greyed-out row.
 *   - Nothing here is carried by colour alone.
 */
import type { Metadata } from 'next';
import { StateRegion } from '../../shared/ui/StateRegion';
import { readMembers } from '../_members/member-api';
import { historyPageSchema } from '../_members/member-schema';
import { HistoryList } from './history-list';

export const metadata: Metadata = {
  title: 'History',
  description: 'The chapters you have read, most recent first.',
};

/** Member data: never prerendered, never cached (PERFORMANCE.md §7). */
export const dynamic = 'force-dynamic';

/**
 * How many sessions this page asks for.
 *
 * The route's own page cap is 48 (API_CONTRACT §2.3) and a history row is a
 * short line, so one screen of rows is 24 and the rest arrives through the
 * island's "load older sessions".
 */
const HISTORY_PAGE_SIZE = 24;

export default async function HistoryPage() {
  const result = await readMembers(
    `/api/history?limit=${String(HISTORY_PAGE_SIZE)}`,
    historyPageSchema,
  );

  if (!result.ok) {
    return (
      <>
        <h1>History</h1>
        {result.failure === 'signed-out' ? (
          <StateRegion
            headingId="history-signed-out"
            headingLevel={2}
            title="Your reading history is only yours when you are signed in"
            cause="This page shows one reader's reading sessions, so it needs a session before it can read anything. Nothing was lost — the sessions are being recorded, and they are waiting."
            remedy="Sign in and this page will show what you have read."
            actions={[
              { href: '/auth/signin?next=/history', label: 'Sign in', primary: true },
              { href: '/library', label: 'Open your library' },
            ]}
          />
        ) : (
          <StateRegion
            headingId="history-unavailable"
            headingLevel={2}
            title="Your reading history is unavailable"
            cause="The list could not be read just now. Nothing has been removed, and the sessions you have read are untouched."
            remedy="Try again in a moment. Opening a chapter again will keep recording where you are."
            actions={[
              { href: '/history', label: 'Try again', primary: true },
              { href: '/library', label: 'Open your library' },
            ]}
          />
        )}
      </>
    );
  }

  if (result.data.items.length === 0) {
    // No reading yet is a real answer, not a fault, so it is its own state with
    // a route out of it (ACCESSIBILITY.md §6). The page only ever asks for page
    // one, so "no items" means "no sessions", not "an empty first page".
    return (
      <>
        <h1>History</h1>
        <StateRegion
          headingId="history-empty"
          headingLevel={2}
          title="You have not read anything yet"
          cause="Reading history is one row per stretch of reading: open a chapter, read some of it, and the session is recorded here with the page you reached. You have not opened a chapter, so there is nothing to show — and nothing is missing from your account."
          remedy="Open a title from the catalog and read a chapter. It will appear here as soon as you do."
          actions={[
            { href: '/discover', label: 'Browse the catalog', primary: true },
            { href: '/library', label: 'Open your library' },
          ]}
        />
      </>
    );
  }

  return (
    <>
      <h1>History</h1>

      <section aria-labelledby="history-list-h">
        <h2 id="history-list-h">What you have read</h2>
        <HistoryList
          items={result.data.items}
          nextCursor={result.data.nextCursor}
          limit={HISTORY_PAGE_SIZE}
        />
      </section>
    </>
  );
}
