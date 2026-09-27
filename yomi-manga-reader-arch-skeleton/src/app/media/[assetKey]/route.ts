/**
 * GET /media/[assetKey] — media delivery route.
 *
 * Requirement: FR-MEDIA-001/002/003, NFR-PERF-009/013, NFR-SEC-010.
 * Task: T-CATALOG-010. Tests: INT-MEDIA-001, E2E-READER-022.
 * Authority: API_CONTRACT §2.1 (`GET /media/{assetKey}`), SECURITY.md §7,
 * ADR-004 (app-mediated delivery), ADR-005 (the format ladder).
 *
 * This file is deliberately THIN (dependency-rules.md "thin handlers"): it
 * resolves the request context, asks `server/media` for the response, and
 * answers. Every rule — grammar, draft visibility, headers, 404 vs 502, the
 * no-passthrough guarantee — lives in `server/media/page-delivery.ts`, where
 * it can be unit-tested without a request.
 *
 * ── Why this route builds its own dependencies ────────────────────────────
 * The composition root (`src/server/composition.ts`) is a skeleton that still
 * throws (T-CATALOG-002), and it is outside this task's write scope. So the
 * route resolves the env and the two ports itself, memoised per process:
 * `loadEnv()` is called exactly once (DEPLOYMENT.md §4 step 1, T-FOUND-002),
 * the S3 client pools its own sockets, and the PG pool is the app pool
 * (DEPLOYMENT.md §1, max 10). T-CATALOG-002 replaces this block with
 * `buildComposition(env)` and deletes it; nothing else in the route changes.
 * TODO(T-CATALOG-002): consume the composition root instead.
 *
 * ── Never cached, never prerendered ────────────────────────────────────────
 * The answer depends on the caller's role (a draft key is 404 for a reader and
 * 200 for an admin) and on bytes that only the origin knows, so this route
 * must never be statically optimized or cached by the framework. The
 * per-response `Cache-Control` in the delivery module is the only cache
 * directive that matters (immutable for assets, 5 s for a 404, no-store for an
 * error); `no-store` here is the belt-and-braces default for the redirect-free
 * HTML-less path.
 */
import { createDb } from '../../../server/db';
import type { Db } from '../../../server/db';
import { deliverPage } from '../../../server/media';
import type { MediaDeliveryDeps } from '../../../server/media';
import { createObjectStorage } from '../../../server/storage';
import { createLogger } from '../../../server/telemetry/logger';
import type { Logger } from '../../../server/telemetry/logger';
import { loadEnv } from '../../../shared/validation';
import type { Env } from '../../../shared/validation';

/** Never prerendered, never cached: the answer is per-caller and per-byte. */
export const dynamic = 'force-dynamic';

/** Only GET exists; everything else is 405 with no body (API_CONTRACT §1). */
export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  const response = await GET(request, context);
  // A HEAD must carry the headers of the GET it mirrors and no body.
  return new Response(null, { status: response.status, headers: response.headers });
}

/** The App Router's dynamic-route context (Next 16 delivers params lazily). */
interface RouteContext {
  readonly params: Promise<{ readonly assetKey: string }>;
}

/** The process-wide, lazily built dependency set (see the header). */
let depsPromise: Promise<{ deps: MediaDeliveryDeps; logger: Logger }> | undefined;

function mediaDeps(): Promise<{ deps: MediaDeliveryDeps; logger: Logger }> {
  depsPromise ??= buildDeps();
  return depsPromise;
}

async function buildDeps(): Promise<{ deps: MediaDeliveryDeps; logger: Logger }> {
  const env: Env = loadEnv();
  const logger = createLogger(env);
  const db: Db = await createDb(env);
  return { deps: { storage: createObjectStorage(env), db, logger }, logger };
}

/**
 * 128-bit hex request id: echoes the ingress value when there is one
 * (API_CONTRACT §1 "x-request-id echoed in every response") and otherwise
 * mints one. T-OBS-003 owns id generation for the app; the error envelope
 * cannot be built without one, so this is the local fallback.
 */
function resolveRequestId(request: Request): string {
  const inbound = request.headers.get('x-request-id');
  return inbound !== null && /^[A-Za-z0-9_-]{8,128}$/.test(inbound)
    ? inbound
    : crypto.randomUUID().replaceAll('-', '');
}

/**
 * Streams one page/cover variant, or answers 404/502/500 per the contract.
 *
 * Never throws: a boot failure (env/DB) and an unexpected error both become
 * the §6 envelope with the §6 status, and neither reveals what failed.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const requestId = resolveRequestId(request);
  try {
    const { deps, logger } = await mediaDeps();
    const { assetKey } = await context.params;
    const response = await deliverPage(assetKey, {
      ...deps,
      cookieHeader: request.headers.get('cookie') ?? undefined,
      signal: request.signal,
      requestId,
      logger,
    });
    // API_CONTRACT §1: the request id is echoed in EVERY response, not only in
    // error bodies — support quotes it from a screenshot of a failed image.
    response.headers.set('x-request-id', requestId);
    return response;
  } catch (cause) {
    const logger = await safeLogger();
    logger?.error(
      { requestId, route: '/media/[assetKey]', code: 'INTERNAL_ERROR' },
      'media delivery: unhandled failure',
    );
    // A boot failure (env refused, database unreachable) and any unexpected
    // error share one answer: the §6 500 envelope, no detail (NFR-SEC-010).
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong.',
          requestId,
        },
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'x-request-id': requestId,
        },
      },
    );
  }
}

/** The logger, or `undefined` when even the env could not be loaded. */
async function safeLogger(): Promise<Logger | undefined> {
  try {
    const { logger } = await mediaDeps();
    return logger;
  } catch {
    return undefined;
  }
}
