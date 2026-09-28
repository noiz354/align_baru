/**
 * The members' HTTP reads — one origin, one cookie replay, one failure shape.
 *
 * Responsibility: the server-side half of the three personal pages. `/library`,
 * `/bookmarks` and `/history` all read the app's own `/api` routes over HTTP,
 * and all three need the same three things to do it honestly: this app's public
 * origin, the caller's own cookies, and a failure that is a VALUE rather than a
 * throw. That is what lives here.
 *
 * Requirements: FR-LIBRARY-003/008/009/010, NFR-SEC-002/010, NFR-PERF-004/008.
 * Tasks: T-LIB-003, T-LIB-005, T-LIB-008 (the pages), T-LIB-007 and
 * T-READER-025 (the routes).
 * Spec: API_CONTRACT §1 (input identity — the owner is the session, never the
 * body), §2.3/§2.4, discover/catalog-data.ts (the same arrangement for the
 * catalog lane).
 *
 * ── Why HTTP and not a repository ───────────────────────────────────────────
 * The UI lane owns no database (rule D6, dependency-rules §1) and imports
 * nothing from `server/*` or `features/*`. It reads the routes a browser would,
 * through the same seam, so the pages exercise the contract rather than a
 * private back door.
 *
 * ── The cookie replay, and why it is not optional ───────────────────────────
 * `resolveCaller` (`src/app/api/_runtime.ts`) reads the `session_token` cookie
 * and answers `null` — a 401 — without it. A React Server Component's `fetch`
 * does NOT forward the browser's cookies, so the incoming `cookie` header is
 * read from `headers()` and replayed. Without that line every page here would
 * render its signed-out state for a reader who IS signed in: a fault that looks
 * exactly like a session bug and sends the investigation the wrong way. The
 * browser side does not need this (the browser sends its own cookies), which is
 * why only these reads carry it.
 *
 * ── Same-origin, absolute URL ───────────────────────────────────────────────
 * A Server Component has no origin and `fetch('/api/…')` is not a valid URL in
 * Node, so the origin is reconstructed from the request headers. `Host` is the
 * app's own public address in every deployment that serves the app and its API
 * from one origin, which is what a self-hosted reader is. Only a loopback host
 * is assumed to be plain http; anything else is https, because guessing "http"
 * for a public host fails in the unsafe direction.
 *
 * SPEC-QUESTION, carried over unchanged from `discover/catalog-data.ts`: an app
 * mounted under a reverse-proxy sub-path (`APP_BASE_PATH`, DEPLOYMENT.md §3)
 * would need that prefix re-applied to the API URL; the header pair alone does
 * not carry it. The correct owner is the deployment / composition task.
 *
 * ── Failure is a value, not a throw ─────────────────────────────────────────
 * A 401 is a different page from a broken read, so the pages map each to its own
 * state (ACCESSIBILITY.md §6). Nothing here throws and nothing here invents an
 * `AppError` code, so API_CONTRACT §6 is untouched (AGENTS.md §4.7).
 */
import 'server-only';

import { headers } from 'next/headers';
import type { z } from 'zod';

/** How long a server-side read may take before the page renders its own state. */
const READ_TIMEOUT_MS = 5_000;

/** Why a read did not produce data — each maps to a distinct state on the page. */
export type MembersFailure =
  /** The route answered 401: there is no session on this request. */
  | 'signed-out'
  /** Refused, timed out, answered something unparseable, or a cursor it cannot read. */
  | 'unavailable';

export type MembersResult<T> = { ok: true; data: T } | { ok: false; failure: MembersFailure };

/**
 * This app's own public origin, from the incoming request.
 *
 * @returns the origin, or null when the request carries no usable host
 */
async function apiOrigin(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
    if (host === null || host === '') return null;
    const isLoopback = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);
    const proto = requestHeaders.get('x-forwarded-proto') ?? (isLoopback ? 'http' : 'https');
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

/** The caller's own cookies, replayed so a member route can recognise them. */
async function sessionCookie(): Promise<string | null> {
  try {
    return (await headers()).get('cookie');
  } catch {
    return null;
  }
}

/**
 * One read of one of this app's member routes, parsed or refused.
 *
 * The identity rule is enforced by what is NOT sent: no `userId` appears in the
 * path, the query or any header, because the owner is the session the route
 * resolves from the cookie (API_CONTRACT §1, THREAT T-04).
 *
 * @param path the route and its query, e.g. `/api/library?sort=added_desc`
 * @param schema the contract's parser (`_members/member-schema.ts`)
 * @returns the parsed payload, or a failure the page renders
 */
export async function readMembers<S extends z.ZodType>(
  path: string,
  schema: S,
): Promise<MembersResult<z.output<S>>> {
  try {
    const [origin, cookie] = await Promise.all([apiOrigin(), sessionCookie()]);
    if (origin === null) return { ok: false, failure: 'unavailable' };
    const response = await fetch(new URL(path, origin), {
      // PERFORMANCE.md §7: v1 has no server-side application cache, and this is
      // one reader's data in any case.
      cache: 'no-store',
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      headers: { accept: 'application/json', ...(cookie === null ? {} : { cookie }) },
    });
    if (response.status === 401) return { ok: false, failure: 'signed-out' };
    // 422 `CATALOG_PAGE_INVALID` (an unreadable cursor) lands here too, which is
    // right: a reader holding a stale cursor gets the page's own "try again",
    // not a 422 rendered as a list.
    if (!response.ok) return { ok: false, failure: 'unavailable' };
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) return { ok: false, failure: 'unavailable' };
    return { ok: true, data: parsed.data };
  } catch {
    // A refused connection, a timeout, or a body that is not JSON: one state to
    // a reader, one state to the page.
    return { ok: false, failure: 'unavailable' };
  }
}

/** What a remove can honestly be. Never a boolean: a 404 is its own sentence. */
export type RemoveOutcome =
  /** 204 — the mark is gone. */
  | 'removed'
  /** 404 `LIBRARY_BOOKMARK_NOT_FOUND` — already gone, or never this reader's. */
  | 'not-found'
  /** Anything else, including a refused connection: the mark is still there. */
  | 'failed';

/**
 * `DELETE /api/bookmarks/{id}` through the same seam a page's read uses.
 *
 * The owner is the session cookie and nothing else: the id in the path is the
 * TARGET, and the route answers 404 for "not yours" and "not there" alike so a
 * probe cannot learn whether another reader's mark exists (THREAT T-04).
 *
 * @param id the bookmark id, untrusted, so it is length-capped and encoded
 */
export async function removeBookmarkThroughApi(id: string): Promise<RemoveOutcome> {
  try {
    const [origin, cookie] = await Promise.all([apiOrigin(), sessionCookie()]);
    if (origin === null) return 'failed';
    // EC-XX-06: a path segment is length-capped. An id longer than a uuid is not
    // a bookmark, and an unbounded segment is an unbounded URL.
    if (id.length === 0 || id.length > 64) return 'failed';
    const response = await fetch(new URL(`/api/bookmarks/${encodeURIComponent(id)}`, origin), {
      cache: 'no-store',
      method: 'DELETE',
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      headers: { ...(cookie === null ? {} : { cookie }) },
    });
    if (response.status === 204) return 'removed';
    if (response.status === 404) return 'not-found';
    return 'failed';
  } catch {
    return 'failed';
  }
}
