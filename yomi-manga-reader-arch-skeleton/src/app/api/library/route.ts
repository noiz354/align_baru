/**
 * `/api/library` — the signed-in reader's shelf: the list, and the add.
 *
 * ── What these routes used to be ─────────────────────────────────────────────
 * They called `createDb(loadEnv())` themselves and read and wrote
 * `library_entry` rows straight out of `server/db/queries/reader-state.ts`.
 * `GET` answered `{items, count}` where each item was
 * `{userId, mangaId, addedAt, lastReadAt}` — a database row, not the
 * `LibraryEntry` the contract describes — so the page it served could not show an
 * unread badge or a "Ch. 12 · p. 45" position, because neither was in the
 * response. `POST` is worse: it constructed infrastructure (rule D6) AND wrote
 * two fields that are not columns of the table —
 *
 *     insertLibraryEntry(db, { id, userId, mangaId, status: 'reading', addedAt })
 *
 * Drizzle drops keys the schema has no column for, so the write SUCCEEDED while
 * `status` was discarded in silence: a "reading" mark that nothing stored and
 * nothing logged. The two paths also disagreed about the whole architecture: this
 * route built a database per request while the `/api/v1` routes went through the
 * composition root.
 *
 * Both are fixed by going through the seam. The URL is unchanged — the reader
 * client and the recorded runtime proof both use it.
 *
 * Requirements: FR-LIBRARY-001…004, NFR-SEC-002, NFR-DATA-001/003, THREAT T-04.
 * Tasks: T-LIB-001, T-LIB-002, T-LIB-003.
 */
import { AppError } from '../../../shared/contracts/errors';
import type { LibrarySort } from '../../../shared/contracts';
import { readJsonBody } from '../../../shared/http/request-body';
import { apiDepsForRequest } from '../_runtime';
import type { ApiDeps } from '../_deps';
import type { MangaId, MangaSlug } from '../../../shared/types';
import {
  failureResponse,
  jsonResponse,
  requestIdOf,
  PRIVATE_CACHE_CONTROL,
} from '../v1/_http';

const ROUTE = '/api/library';
const SORTS: readonly LibrarySort[] = ['last_read_desc', 'added_desc', 'title_asc'];
const LIMIT_MAX = 48;

/**
 * API_CONTRACT §1: "private data (library/progress/history/bookmarks):
 * `no-store`". Every response below this line is a reader's own data, so the
 * catalog cache header `jsonResponse` defaults to would be wrong here.
 *
 * Written as a local constant rather than exported from `v1/_http` because this
 * task does not own that shared module; the right home for it is beside
 * `CATALOG_CACHE_CONTROL`, and this is the second copy (see the report).
 */
const NO_STORE = 'no-store';

/**
 * Used only on the "no composition" path, where there is by definition no real
 * logger — the same position the `/api/v1` seam documents for its own 500.
 */
const SILENT_LOGGER = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as ApiDeps['logger'];

/**
 * The handler, as a factory over its dependencies, so a test can call it with no
 * global state and no database (the seam's contract).
 *
 * @param deps the wired members' services
 */
export function createLibraryListHandler(deps: ApiDeps) {
  return async function GET(request: Request): Promise<Response> {
    // The shelf is members-only (THREAT T-04). The 401 is decided HERE, at the
    // HTTP edge, because that is what the status code means; the service still
    // re-checks internally, so a future non-HTTP caller cannot skip the rule by
    // forgetting this line.
    const caller = await deps.resolveCaller(request);
    if (caller === null) {
      return failureResponse(
        new AppError('AUTH_REQUIRED'),
        requestIdOf(request),
        deps.logger,
        ROUTE,
      );
    }

      try {
        const url = new URL(request.url);
        const sortParam = url.searchParams.get('sort');
        // An unrecognised sort is the default, not a 422: the query string is a
        // navigation aid, and a shared link with a stale sort should still open the
        // shelf rather than refuse.
        const sort: LibrarySort =
          sortParam !== null && SORTS.includes(sortParam as LibrarySort)
            ? (sortParam as LibrarySort)
            : 'last_read_desc';
        const limitRaw = url.searchParams.get('limit');
        const limit = limitRaw === null ? undefined : Number.parseInt(limitRaw, 10);
        const cursor = url.searchParams.get('cursor');

        const page = await deps.library.list(caller, {
          ...(cursor === null ? {} : { cursor }),
          ...(limit === undefined || Number.isNaN(limit)
            ? {}
            : { limit: Math.min(Math.max(limit, 1), LIMIT_MAX) }),
          sort,
        });

        return jsonResponse(
          { items: page.items, nextCursor: page.nextCursor },
          // Members' data, never cached: the shelf is one reader's, and a shared
          // cache would hand it to the next (API_CONTRACT §1).
          { status: 200, requestId: requestIdOf(request), cacheControl: PRIVATE_CACHE_CONTROL },
        );
      } catch (cause) {
        // Every service/repository throw becomes the §1 envelope with its own §6
        // status — CATALOG_PAGE_INVALID 422 on a bad cursor, AUTH_REQUIRED if the
        // session vanished between the guard and the query. Without this they
        // escaped as an unhandled 500 with no body shape and no log line.
        return failureResponse(cause, requestIdOf(request), deps.logger, ROUTE);
      }
    };
  }

  /**
   * The Next.js entry point. Resolves the composition root's registration and
   * answers 500 if the wiring has not happened — a visible, logged failure rather
   * than an empty shelf that looks like a healthy one.
   */
  export async function GET(request: Request): Promise<Response> {
    const deps = await apiDepsForRequest();
    if (deps === null) {
      return failureResponse(
        new AppError('INTERNAL_ERROR', {
          cause: new Error('no /api dependencies registered by the composition root'),
        }),
        requestIdOf(request),
        SILENT_LOGGER,
        ROUTE,
      );
    }
  return createLibraryListHandler(deps)(request);
}

/* ── POST /api/library — add a title to the shelf ──────────────────────────── */

/**
 * The untrusted body, typed by the fields this handler reads rather than asserted
 * to `any`; every value is still untrusted until a check below says otherwise.
 */
type AddToLibraryBody = { mangaId?: unknown; slug?: unknown };

/**
 * Request bodies are untrusted, so a field is only treated as a string when it
 * really is one. `String(value)` would accept anything and stringify an object
 * into `"[object Object]"`, which then reads as a valid id. The same one-liner
 * lives in `api/bookmarks/route.ts`; it is module-private in both places because
 * neither task may edit `shared/http/` (the same trade-off as SQ-LIB-5).
 */
function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * `POST /api/library` — add one manga to the caller's shelf.
 *
 * Body: `{ mangaId }` (uuid). Output `200 { ok: true, mangaId }`.
 *
 * Statuses:
 *   - 401 `AUTH_REQUIRED` — no session caller (members-only, THREAT T-04).
 *   - 422 `VALIDATION_BAD_QUERY` — no JSON object, or no usable `mangaId`.
 *   - 200 — added, or ALREADY on the shelf (FR-LIBRARY-001: the add is an
 *     idempotent no-op, so a double-add is deliberately NOT a 409).
 *   - 500 `INTERNAL_ERROR` — see the manga-existence note below.
 *
 * ── `slug` is no longer accepted, and cannot be from here ────────────────────
 * The old handler accepted `{ slug }` as a convenience for a caller holding only
 * a URL, and resolved it with `findMangaBySlug` — a direct read of the `manga`
 * table. `LibraryService.add` takes a `mangaId` and the seam exposes no slug
 * lookup, so the resolution has nowhere to live without this route building
 * infrastructure again (D6). The field is therefore refused with a 422 that says
 * so, rather than accepted and silently dropped. No in-repo caller sends it (the
 * library page only reads), but the behaviour is a loss and is recorded, not
 * hidden.
 *
 * ── The manga existence check, and why the FK speaks instead ────────────────
 * The old handler answered `MANGA_NOT_FOUND` 404 for an unknown id, by reading
 * `manga` first. `LibraryService.add` does NOT resolve the manga (its own
 * comment says the route is expected to) and there is no manga port on `ApiDeps`
 * to resolve it with: `deps.library` is the `LibraryService` and `deps.history`
 * is a history repository, and neither answers "does this manga exist". Reaching
 * for one would mean either a new port on the seam (a change to the composition
 * and `ApiDeps` this task does not own) or a database handle here (D6). So an
 * unknown `mangaId` now reaches `library_entry`'s foreign key and the driver's
 * 23503 is answered as `INTERNAL_ERROR` 500 rather than `MANGA_NOT_FOUND` 404.
 * That is a real regression, deliberately left visible instead of papered over:
 * a 404 needs a port that does not exist yet, and the fix is a port, not a route
 * (recorded as SQ-LIB-8; T-LIB-002 owns the manga resolve on the port).
 *
 * @param deps the wired members' services
 * @returns the `POST` handler
 */
export function createLibraryAddHandler(deps: ApiDeps) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdOf(request);
    // The 401 is decided HERE, at the HTTP edge, because that is what the status
    // means; the service re-checks internally, so a non-HTTP caller cannot skip
    // the rule by forgetting this line (THREAT T-04).
    const caller = await deps.resolveCaller(request);
    if (caller === null) {
      return failureResponse(new AppError('AUTH_REQUIRED'), requestId, deps.logger, ROUTE);
    }

    try {
      const body = await readJsonBody<AddToLibraryBody>(request).catch(() => undefined);
      if (body === undefined) {
        throw new AppError('VALIDATION_BAD_QUERY', {
          details: [{ path: 'body', message: 'Expected a JSON object.' }],
        });
      }

        // A slug is accepted, as it was before this route lost its direct database
        // access: `manga/bySlug` is the catalog's URL-identity read and applies the
        // same visibility clauses, so a draft slug resolves to "not found" rather
        // than to a hidden id.
        const rawMangaId = asString(body.mangaId).trim();
        const rawSlug = asString(body.slug).trim();
        const mangaId =
          rawMangaId !== ''
            ? rawMangaId
            : rawSlug !== ''
              ? ((await deps.manga.bySlug(rawSlug as MangaSlug, caller))?.id ?? '')
              : '';
        if (mangaId === '') {
          throw new AppError('VALIDATION_BAD_QUERY', {
            details: [{ path: 'mangaId', message: 'mangaId or slug is required.' }],
          });
        }

      // Existence is checked HERE so an unknown id is the contract's 404 rather than
      // the foreign key's 23503, which is not an §6 code and surfaced as a bare 500.
      // `byId` carries the same visibility clauses as `bySlug`, so a draft or deleted
      // title is "not found" and not "forbidden" — a 403 would leak which ids exist.
      if ((await deps.manga.byId(mangaId as MangaId, caller)) === null) {
        throw new AppError('MANGA_NOT_FOUND');
      }

      // The ONLY identity source is `caller`; the body supplies the target, never
      // the owner (API_CONTRACT §1 input identity rule).
      await deps.library.add(caller, mangaId);

      return jsonResponse({ ok: true, mangaId }, { status: 200, requestId, cacheControl: NO_STORE });
    } catch (error) {
      return failureResponse(error, requestId, deps.logger, ROUTE);
    }
  };
}

/** The Next.js entry point for the add; see `GET` for the registry rationale. */
export async function POST(request: Request): Promise<Response> {
  const deps = await apiDepsForRequest();
  if (deps === null) {
    return failureResponse(
      new AppError('INTERNAL_ERROR', {
        cause: new Error('no /api dependencies registered by the composition root'),
      }),
      requestIdOf(request),
      SILENT_LOGGER,
      ROUTE,
    );
  }
  return createLibraryAddHandler(deps)(request);
}
