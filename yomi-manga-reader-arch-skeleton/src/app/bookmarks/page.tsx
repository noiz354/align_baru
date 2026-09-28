import 'server-only';

/**
 * Bookmarks (`/bookmarks`) — the pages a reader kept, read live.
 *
 * Requirements: FR-LIBRARY-009 (a mark is a page plus an optional note),
 * FR-LIBRARY-010 (the list and the remove), DATA_MODEL §14, NFR-DATA-005,
 * NFR-A11Y-003/004, NFR-SEC-010, NFR-SEC-016 (the note is plain text).
 * Tasks: T-LIB-008 (this page and its island), T-LIB-007 (the bookmark API it
 * consumes, including the `DELETE /api/bookmarks/{id}` this page now calls).
 * Spec: shared/contracts/library.ts `Bookmark`, API_CONTRACT §2.4,
 * ACCESSIBILITY.md §2/§3.3/§6.
 *
 * ── The feed this page consumes, and what is in it ──────────────────────────
 * `GET /api/bookmarks` (src/app/api/bookmarks/route.ts) answers
 * `{ items: Bookmark[], nextCursor }`, and a `Bookmark` is
 * `{ id, chapter: {id, number, mangaSlug, mangaTitle} | null, pageNumber, note,
 * createdAt }`. So a mark can be NAMED (manga title, chapter number) and can be
 * OPENED (slug + number + `?page=`) — the list used to be a single-table select
 * with no join, and it used to say on the page that the title and chapter number
 * were not in the response. Both are gone, and so is the join-less workaround.
 *
 * `chapter: null` is still a real state and is the honest form of the
 * "Unavailable chapter" rule: `bookmark.chapter_id` is `ON DELETE SET NULL`
 * (DATA_MODEL §14), so a null chapter IS a chapter that was deleted. The row is
 * kept, the jump is not offered, and the remove still is (NFR-DATA-005).
 *
 * ── Why the read goes out over HTTP, like /discover ─────────────────────────
 * The UI lane owns no database (D6, dependency-rules §1). This page reads the
 * routes a browser would and imports nothing from `server/*` or `features/*`.
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
 * ── The remove, and why it is a Server Action rather than a `fetch` ─────────
 * `DELETE /api/bookmarks/{id}` (src/app/api/bookmarks/[id]/route.ts) is a real
 * route now, so the action this page used to leave empty is built. A Server
 * Action is the form of that call that costs nothing when scripting is off: the
 * button is a real `<form>` submit, React serialises the action for the
 * no-JavaScript path, and the reader can always remove a mark. With scripting
 * on, the same button opens the shared `Dialog` first, and the dialog's confirm
 * button submits that same form — one action, two behaviours, no second code
 * path (the island's header says how the states are reported).
 *
 * The action sends no `userId` and takes no owner from the form: the id in the
 * hidden field is the TARGET and the session cookie is the owner, so the route's
 * "not yours ⇒ 404" is the only ownership rule there is (API_CONTRACT §1 input
 * identity, THREAT T-04). Next.js checks the Origin header on every Server
 * Action call, which is the CSRF property this POST-shaped call needs.
 *
 * ── A11y notes ────────────────────────────────────────────────────────────
 *   - Real `ul`/`li`, one row per bookmark, every row's content readable as
 *     text — the page never relies on position or colour.
 *   - "Unavailable chapter" is a WORD in a dashed chip, not a greyed-out row: a
 *     reader who cannot separate the states still knows why a row cannot be
 *     opened (ACCESSIBILITY.md §3.3).
 *   - The count is a live region that is always in the document, so an appended
 *     page has something to announce into.
 *   - The note is a text node and never markup (NFR-SEC-016).
 */
import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { StateRegion } from '../../shared/ui/StateRegion';
import { readMembers, removeBookmarkThroughApi } from '../_members/member-api';
import { bookmarkPageSchema } from '../_members/member-schema';
import { BookmarksList, type RemoveState } from './bookmarks-list';

export const metadata: Metadata = {
  title: 'Bookmarks',
  description: 'The pages you kept, with the note you wrote beside each one.',
};

/** Member data: never prerendered, never cached (PERFORMANCE.md §7). */
export const dynamic = 'force-dynamic';

/**
 * How many marks this page asks for.
 *
 * The route's own page cap is 48 (API_CONTRACT §2.4, SQ-LIB-3) and a saved-page
 * list is read in columns, so one screen of rows is 24 and the rest arrives
 * through the island's "load more", which presents the opaque `nextCursor` this
 * page cannot construct.
 */
const BOOKMARK_PAGE_SIZE = 24;

/**
 * The remove.
 *
 * A form body is untrusted, so the id is taken as a string only when it really
 * is one — `String(value)` would stringify an object into `"[object Object]"`,
 * which then reads as an id. The bound is `removeBookmarkThroughApi`'s, so this
 * action does not keep a second copy of the rule.
 *
 * The result is deliberately coarse: 204 and 404 both mean "this mark is no
 * longer on the list", because the route answers 404 for "not yours" and "not
 * there" alike (THREAT T-04) and a reader removing their own mark cannot tell
 * those apart — nor should they be able to. `failed` is the one state that means
 * the mark is still saved, and the dialog stays open and says so.
 *
 * @param _previous the form's prior state, required by `useActionState` and unused
 * @param formData the submitted form
 */
async function removeBookmark(_previous: RemoveState, formData: FormData): Promise<RemoveState> {
  'use server';

  const raw = formData.get('bookmarkId');
  const id = typeof raw === 'string' ? raw : '';
  const outcome = await removeBookmarkThroughApi(id);
  if (outcome === 'failed') return { status: 'failed' };
  // The list this page renders is a read of `/api/bookmarks`; re-running it
  // after the write is what makes the removed row disappear on return, without
  // a client-side guess about what the list now holds.
  revalidatePath('/bookmarks');
  return { status: 'removed' };
}

export default async function BookmarksPage() {
  const result = await readMembers(
    `/api/bookmarks?limit=${String(BOOKMARK_PAGE_SIZE)}`,
    bookmarkPageSchema,
  );

  if (!result.ok) {
    return (
      <>
        <h1>Bookmarks</h1>
        {result.failure === 'signed-out' ? (
          <StateRegion
            headingId="bookmarks-signed-out"
            headingLevel={2}
            title="Your bookmarks are only yours when you are signed in"
            cause="This page shows one reader's saved pages, so it needs a session before it can read anything. Nothing was lost — the bookmarks are waiting."
            remedy="Sign in and this page will show them."
            actions={[
              { href: '/auth/signin?next=/bookmarks', label: 'Sign in', primary: true },
              { href: '/discover', label: 'Browse the catalog' },
            ]}
          />
        ) : (
          <StateRegion
            headingId="bookmarks-unavailable"
            headingLevel={2}
            title="Your bookmarks are unavailable"
            cause="The list could not be read just now. Nothing has been removed, and the marks you made are still on the page you made them from."
            remedy="Try again in a moment."
            actions={[
              { href: '/bookmarks', label: 'Try again', primary: true },
              { href: '/discover', label: 'Browse the catalog' },
            ]}
          />
        )}
      </>
    );
  }

  if (result.data.items.length === 0) {
    // An empty list is a real answer, not a fault, so it gets its own state and
    // a route out of it (ACCESSIBILITY.md §6). The page only ever asks for page
    // one, so "no items" here means "no marks", not "an empty first page".
    return (
      <>
        <h1>Bookmarks</h1>
        <StateRegion
          headingId="bookmarks-empty"
          headingLevel={2}
          title="You have not marked any pages yet"
          cause="A bookmark is a page you kept: the spot you wanted to come back to, optionally with a note beside it. You have not made one, so there is nothing here — and nothing is missing from your account."
          remedy="Open a chapter in the reader and mark the page you want to keep. It will appear here."
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
      <h1>Bookmarks</h1>

      <section aria-labelledby="bookmarks-list-h">
        <h2 id="bookmarks-list-h">Saved pages</h2>
        <BookmarksList
          items={result.data.items}
          nextCursor={result.data.nextCursor}
          limit={BOOKMARK_PAGE_SIZE}
          removeAction={removeBookmark}
        />
      </section>
    </>
  );
}
