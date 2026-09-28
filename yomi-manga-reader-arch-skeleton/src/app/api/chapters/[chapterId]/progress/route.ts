/**
 * Reading progress for one chapter — `GET` restores, `POST` records.
 *
 * ── The defect this route carried, and why it is fixed here ──────────────────
 * `POST` used to call `queries/reader-state.ts`'s `upsertProgress`, which
 * plain-overwrites `completed`, and it passed `completed: Boolean(body.completed)`
 * — while the reader client sends ONLY `{ pageNumber }`. So `body.completed` was
 * always `undefined`, always `false`, and **every page change erased a finished
 * chapter**. Silent: no error, no log line, and the reader's own record was wrong.
 *
 * The same path never maintained `library_entry.last_read_at`, so the shelf's
 * DEFAULT `last_read_desc` sort stayed NULL for anything read here.
 *
 * `ReaderProgressRepository` has been correct the whole time — LWW, idempotence,
 * sticky-OR, and the denormalized touch, in one transaction, guarded by a
 * conflict-clause `WHERE` so two racing tabs cannot both win. The route simply was
 * not on it. A route that writes a table a repository owns is how that happened,
 * so the route now reaches the repository through the seam and holds no handle of
 * its own.
 *
 * It also no longer builds its own `Db`. That was one of the three connections
 * F-001 set out to remove, and it was the one still open after F-001-S1/S2 because
 * this route was not part of the members' seam until now. → F-006-S2 removes
 * `reader-state.ts` entirely.
 *
 * ── Status codes, unchanged ──────────────────────────────────────────────────
 * 401 anonymous · 404 unknown chapter · 422 malformed or out-of-range page ·
 * 200 with the persisted page number. These were correct before and are
 * deliberately identical now: a rewire that quietly changed a status code would
 * be a new defect, so the negative tests assert the same numbers they always did.
 *
 * Requirements: FR-READER-014, NFR-DATA-001, NFR-DATA-003
 * Tasks: T-READER-021, T-READER-022; remaining cleanup F-006-S2
 */
import { AppError } from '../../../../../shared/contracts/errors';
import { readJsonBody } from '../../../../../shared/http/request-body';
import type { ChapterId } from '../../../../../shared/types';
import { apiDepsForRequest } from '../../../_runtime';
import type { ApiDeps } from '../../../_deps';
import {
  PRIVATE_CACHE_CONTROL,
  failureResponse,
  jsonResponse,
  requestIdOf,
} from '../../../v1/_http';

const ROUTE = 'api.chapters.progress';

/**
 * Used only for the "no deps registered" path, which is a wiring bug rather than a
 * client error: there is no logger to log with until the deps exist.
 */
const SILENT_LOGGER = {
  error() {},
  warn() {},
  info() {},
  debug() {},
} as unknown as ApiDeps['logger'];

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ chapterId: string }>;
}

interface ProgressBody {
  pageNumber?: unknown;
  scrollPosition?: unknown;
}

/**
 * `GET` — the reader's saved position, or null.
 *
 * Returns RAW progress. Clamping a stored page that is past the current
 * `page_count` is the reader's job (EC-RDR-10), not this route's: a route that
 * quietly fixed it would report a page the reader never saw.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const requestId = requestIdOf(request);
  const deps = await apiDepsForRequest();
  if (deps === null) {
    return failureResponse(
      new AppError('INTERNAL_ERROR', {
        cause: new Error('no /api dependencies registered by the composition root'),
      }),
      requestId,
      SILENT_LOGGER,
      ROUTE,
    );
  }
  const caller = await deps.resolveCaller(request);
  if (caller === null) {
    return failureResponse(new AppError('AUTH_REQUIRED'), requestId, deps.logger, ROUTE);
  }

  try {
    const { chapterId } = await context.params;
    const progress = await deps.readerProgress.getProgress(caller.userId, chapterId as ChapterId);
    if (progress === null) {
      return jsonResponse(
        { progress: null },
        {
          status: 200,
          requestId,
          cacheControl: PRIVATE_CACHE_CONTROL,
        },
      );
    }
    return jsonResponse(
      { progress: { pageNumber: progress.pageNumber, scrollPosition: progress.scrollPosition } },
      { status: 200, requestId, cacheControl: PRIVATE_CACHE_CONTROL },
    );
  } catch (cause) {
    return failureResponse(
      cause instanceof AppError ? cause : new AppError('INTERNAL_ERROR', { cause }),
      requestId,
      deps.logger,
      ROUTE,
    );
  }
}

/**
 * `POST` — record the reader's position.
 *
 * `completed` is NOT read from the body. The reader never sent it, and honouring
 * a client-sent `completed: false` is precisely the bug above. Completion is set
 * by the sticky-OR inside the repository, and cleared only by the dedicated unset
 * operation (F-008-S1) — never by moving between pages.
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const requestId = requestIdOf(request);
  const deps = await apiDepsForRequest();
  if (deps === null) {
    return failureResponse(
      new AppError('INTERNAL_ERROR', {
        cause: new Error('no /api dependencies registered by the composition root'),
      }),
      requestId,
      SILENT_LOGGER,
      ROUTE,
    );
  }
  const caller = await deps.resolveCaller(request);
  if (caller === null) {
    return failureResponse(new AppError('AUTH_REQUIRED'), requestId, deps.logger, ROUTE);
  }

  try {
    const { chapterId } = await context.params;
    const body = await readJsonBody<ProgressBody>(request).catch(() => undefined);
    if (body === undefined) {
      throw new AppError('VALIDATION_BAD_QUERY', {
        details: [{ path: 'body', message: 'Expected a JSON object.' }],
      });
    }

    // Untrusted input: a value is only a page number if it really is one.
    // `Number('abc')` is NaN and `Number(true)` is 1, so the type is checked
    // before the value, and `pageNumber < 1` is refused rather than clamped —
    // page 0 is a client bug worth answering, not silently rounding to page 1.
    const rawPage = body.pageNumber;
    const pageNumber = typeof rawPage === 'number' ? rawPage : Number(rawPage);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new AppError('READER_INVALID_PAGE', {
        details: [{ path: 'pageNumber', message: 'Must be an integer of at least 1.' }],
      });
    }

    const chapter = await deps.chapters.byId(chapterId as ChapterId, caller);
    if (chapter === null) {
      throw new AppError('CHAPTER_NOT_FOUND');
    }
    if (pageNumber > chapter.pageCount) {
      throw new AppError('READER_INVALID_PAGE', {
        details: [
          {
            path: 'pageNumber',
            message: `Page out of range: this chapter has ${chapter.pageCount} page(s).`,
          },
        ],
      });
    }

    const rawScroll = body.scrollPosition;
    const scrollPosition = rawScroll === undefined || rawScroll === null ? 0 : Number(rawScroll);

    // The single write. LWW, idempotence, sticky-OR and the `last_read_at` touch
    // are all inside this one transaction, and none of them is the route's to
    // reproduce.
    await deps.readerProgress.saveProgress(caller.userId, {
      chapterId: chapterId as ChapterId,
      pageNumber,
      scrollPosition: Number.isFinite(scrollPosition) ? scrollPosition : 0,
      // The reader's clock is NOT stored. A client clock decides last-write-wins
      // only inside `mergeProgress` (SQ-RDR-1); here the server stamps it.
      completed: false,
    });

    return jsonResponse(
      { ok: true, pageNumber },
      { status: 200, requestId, cacheControl: PRIVATE_CACHE_CONTROL },
    );
  } catch (cause) {
    return failureResponse(
      cause instanceof AppError ? cause : new AppError('INTERNAL_ERROR', { cause }),
      requestId,
      deps.logger,
      ROUTE,
    );
  }
}
