/**
 * `/api/v1` HTTP helpers — the envelope, the headers and the error mapping.
 *
 * Requirements: API_CONTRACT §1 (JSON only, `x-request-id` echoed, the catalog
 * cache header, the `{ error: { code, message, details?, requestId } }` body),
 * NFR-SEC-010 (5xx bodies never carry internals), T-13.
 * Tasks: T-CATALOG-002, T-CATALOG-007. Errors: T-FOUND-009 (`toRouteError`).
 *
 * Three rules this module exists to make structural rather than conventional:
 *
 * 1. EVERY response goes through {@link jsonResponse}, so `content-type`,
 *    `x-request-id` and the cache header cannot be forgotten on one branch.
 * 2. EVERY failure goes through {@link failureResponse}, which is the only
 *    caller of `toRouteError`. A handler therefore cannot invent a code, cannot
 *    build an envelope by hand, and cannot render `error.message` from a cause.
 * 3. An UNEXPECTED throw is logged and answered with the generic
 *    `INTERNAL_ERROR` envelope. The 5xx body is assembled from the §6 mapping
 *    alone, so a driver message, a DSN or a stack cannot reach a client
 *    (NFR-SEC-010). The `cause` stays reachable for the log line only.
 */
import { AppError, toRouteError } from '../../../shared/contracts/errors';
import type { ErrorCode } from '../../../shared/contracts/errors';
import type { Logger, LogLevel } from '../../../server/telemetry/logger';

/**
 * API_CONTRACT §1: "catalog/detail APIs: `Cache-Control: private, max-age=60,
 * stale-while-revalidate=60`; private data (library/progress/history/
 * bookmarks): `no-store`". The three endpoints in this tree are all
 * catalog/detail reads, so all three take this value.
 */
export const CATALOG_CACHE_CONTROL = 'private, max-age=60, stale-while-revalidate=60';

/**
 * A request id that cannot be anything but an id. `x-request-id` arrives from
 * a client, and the same value is bound to every log line for the request
 * (OBSERVABILITY.md §7) — a value carrying a newline, a quote or a JSON
 * fragment would forge a log line. This mirrors the guard the logger applies
 * on its side; the route applies it before the value is echoed back.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * The request id for one request: the client's, when it is safe, otherwise a
 * fresh v4 UUID.
 *
 * @param request the incoming request
 * @returns a value safe to echo in a header and to bind to every log line
 */
export function requestIdOf(request: Request): string {
  const supplied = request.headers.get('x-request-id');
  if (supplied !== null && SAFE_REQUEST_ID.test(supplied)) return supplied;
  return crypto.randomUUID();
}

/** The JSON content type (API_CONTRACT §1: JSON only). */
const JSON_TYPE = 'application/json; charset=utf-8';

export interface JsonOptions {
  /** The `x-request-id` to echo (API_CONTRACT §1). */
  readonly requestId: string;
  /** Overrides {@link CATALOG_CACHE_CONTROL}; pass `no-store` for private data. */
  readonly cacheControl?: string;
}

/**
 * The single JSON response constructor for this tree.
 *
 * @param body the serialisable payload
 * @param init the status and the headers
 * @returns a Response with the JSON type, the request id and the cache header
 */
export function jsonResponse(body: unknown, init: { status: number } & JsonOptions): Response {
  return new Response(JSON.stringify(body), {
    status: init.status,
    headers: {
      'content-type': JSON_TYPE,
      'cache-control': init.cacheControl ?? CATALOG_CACHE_CONTROL,
      'x-request-id': init.requestId,
    },
  });
}

/**
 * Turns any thrown value into the API_CONTRACT §1 error envelope.
 *
 * An `AppError` is mapped by the frozen §6 table, so its status, message and
 * alert flag are the normative ones. Anything else is an unhandled failure: it
 * is logged with its cause and answered as `INTERNAL_ERROR` (500) with the
 * generic §6 message — never the thrown object's own text.
 *
 * @param error the thrown value
 * @param requestId echoed into the body so a user can quote it to support
 * @param logger the logging facade
 * @param route the route TEMPLATE (OBSERVABILITY.md §2.3 — never a real id)
 * @returns the mapped response
 */
export function failureResponse(
  error: unknown,
  requestId: string,
  logger: Logger,
  route: string,
): Response {
  if (error instanceof AppError) {
    const mapped = toRouteError(error, requestId);
    const fields = {
      requestId,
      route,
      code: mapped.body.error.code,
      status: mapped.httpStatus,
      // `alerts` is the §6 → OBSERVABILITY.md §5 signal; a handler that dropped
      // it would make the alerting rule depend on a downstream filter.
      alerts: mapped.alerts,
    };
    logger[levelFor(mapped.logLevel)](
      { ...fields, ...(error.cause === undefined ? {} : { cause: describeCause(error.cause) }) },
      'Request failed.',
    );
    return jsonResponse(mapped.body, { status: mapped.httpStatus, requestId });
  }
  // Not an AppError: a bug or an infrastructure failure. The §6 envelope is
  // generic and the cause never reaches the body (NFR-SEC-010).
  logger.error({ requestId, route, cause: describeCause(error) }, 'Unhandled error.');
  const mapped = toRouteError(new AppError('INTERNAL_ERROR', { cause: error }), requestId);
  return jsonResponse(mapped.body, { status: mapped.httpStatus, requestId });
}

function levelFor(level: LogLevel): 'info' | 'warn' | 'error' {
  if (level === 'error') return 'error';
  if (level === 'warn') return 'warn';
  return 'info';
}

/**
 * A one-line description of an unknown failure for the LOG line only. A DSN is
 * scrubbed: a driver's own message can carry it (NFR-OBS-006 redaction).
 */
function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message.replace(/postgres(?:ql)?:\/\/\S+/g, '<dsn>')}`;
  }
  return typeof cause;
}

/**
 * The codes this tree raises, re-exported so a handler cannot typo one.
 */
export type { ErrorCode };

/**
 * A logger that discards everything.
 *
 * It exists for exactly one path: a request that arrives BEFORE the composition
 * root has registered a logger, which on the `/api/v1` tree can only mean the
 * root has not run at all. Failing that request needs a logger-shaped argument
 * and `console` is banned in product code (AGENTS §4.1), so the honest options
 * are this or nothing — and a boot-order failure that says so in its own 500
 * body is more useful than one that says so on stdout and nowhere else.
 *
 * Every line a real request produces goes through the OBSERVABILITY.md §3
 * facade; this never sees one.
 */
export const SILENT_LOGGER: Logger = {
  level: 'silent',
  fatal: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  info: () => undefined,
  debug: () => undefined,
  child: () => SILENT_LOGGER,
};
