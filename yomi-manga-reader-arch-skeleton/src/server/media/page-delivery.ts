/**
 * server/media — page/cover DELIVERY (the /media/{assetKey} contract).
 *
 * Responsibility: resolve an asset key → DB lookup (ix_pages_asset_key) →
 * storage stream → response with the exact header contract:
 *   Content-Type (per STORED format — never the original filename),
 *   Content-Length, ETag, Cache-Control: public, max-age=31536000,
 *   immutable, X-Content-Type-Options: nosniff, Content-Disposition: inline.
 *
 * Requirements: FR-MEDIA-001…003, NFR-PERF-009/013, NFR-SEC-010,
 * THREAT T-11.
 * Tasks: T-CATALOG-010 (implementation), INT-MEDIA-001, E2E-READER-022
 * (enumeration fuzz), T-PERF-002 (cache matrix).
 *
 * Security invariants (normative):
 * - Unknown / draft / deleted keys ⇒ 404 (cheap single lookup; enumeration is
 *   safe by design — T-11).
 * - Storage failures ⇒ 502 STORAGE_ERROR — vendor XML NEVER passes through
 *   (NFR-SEC-010).
 * - Streaming only: no full-object buffering in Node (PERFORMANCE §4).
 * - Immutable per key: content per key never changes (re-ingest = new
 *   keys) — what makes the 1-year cache safe (NFR-PERF-013).
 *
 * ── The delivery key grammar (ambiguity, and the choice) ───────────────────
 * API_CONTRACT §2.1 validates the path key as "22–64 base64url chars" and
 * still requires three distinct URLs per page (`urlAvif`, `urlWebp`,
 * `urlJpeg`, "each /media/{assetKey}") with the Content-Type taken from the
 * STORED format. A bare opaque key cannot satisfy both: it has no format, so
 * two readings exist — (a) one URL and a content negotiation, or (b) the
 * format travels in the key. ADR-005 settled (a) out: "no runtime
 * negotiation server-side — `<picture>` picks the variant", and ADR-004's
 * layout already names the format as the object suffix:
 * `pages/{chapterId}/{pageKey}.{avif|webp|jpeg}`. So the delivery key is the
 * opaque key plus the stored extension, mirroring the object key exactly:
 *
 *     /media/{128-bit base64url key}.{avif|webp|jpeg}
 *
 * The `chapter_page.asset_key` column stores the BASE key (one row per page,
 * three `byte_size_*` columns — DATA_MODEL §10); the extension selects the
 * variant. Anything that does not match the grammar is a 404, never a 422
 * (API_CONTRACT §2.1 "malformed → 404, not 422"), and the grammar check runs
 * BEFORE any I/O — a cheap 404 stays cheap when the origin is down.
 *
 * spec-question for API_CONTRACT §2.1 (SQ-CAT-4, RESOLVED by T-CATALOG-010):
 * the "22–64 base64url chars" validation row now states the extension suffix,
 * and the pages row names three distinct `/media/{assetKey}.{variant}` URLs.
 * Still open: MEDIA_NOT_FOUND (named in §2.1 and SECURITY.md §7) has no row
 * in §6, so this module uses the 404 codes that do exist —
 * CHAPTER_NOT_FOUND for a page key, MANGA_NOT_FOUND for a cover key. Both
 * render "not found" text; neither reveals which key class matched.
 *
 * ── ETag (ambiguity A4, carried from server/storage) ───────────────────────
 * `ObjectStoragePort.getStream` returns no origin ETag (only contentType +
 * byteLength), and the port is not editable in this task. The delivery ETag is
 * therefore a WEAK validator built from the two things that are stable and
 * content-bound: the immutable key and the stored length —
 * `W/"{key}.{byteLength}"`. Weak is the correct strength: a client that
 * revalidates gets "same or equivalent representation" semantics, which is
 * true because a key's bytes never change (NFR-PERF-013), and a strong ETag
 * would be a lie about bytes we never hashed. T-PERF-002 owns the header
 * matrix; if the port ever grows an ETag, swap this derivation and the tests
 * below keep passing.
 */
import { AppError, toRouteError } from '../../shared/contracts/errors';
import type { ErrorCode } from '../../shared/contracts/errors';
import { isMangaVisible } from '../../features/manga';
import type { DeliveryFormat, ObjectStoragePort } from '../../shared/contracts/ports';
import type { AssetKey } from '../../shared/types';
import type { Db } from '../db';
import { coverObjectKey, ObjectNotFoundError, pageObjectKey } from '../storage';
import type { StorageCallOptions } from '../storage';
import { callerIsAdmin } from './session-role';
import type { Logger } from '../telemetry/logger';

/* ── the contract constants ──────────────────────────────────────────────── */

/** FR-MEDIA-001 / NFR-PERF-013: a processed asset never changes again. */
export const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * A 404 is cacheable for a few seconds only (T-PERF-002 "CDN-less 404 cache
 * (5 s only, not immutable)"): a draft that is published seconds later must
 * stop 404-ing, and an unknown key must not be cached for a year.
 */
export const MEDIA_NOT_FOUND_CACHE_CONTROL = 'public, max-age=5, must-revalidate';

/** A 502 must never be cached by anything (API_CONTRACT §1 caching rules). */
export const MEDIA_ERROR_CACHE_CONTROL = 'no-store';

/** Retry hint for a 502: the origin is expected back within seconds. */
export const MEDIA_RETRY_AFTER_SECONDS = '5';

/** Content type per STORED format (FR-MEDIA-002 ladder, ADR-005). */
const FORMAT_CONTENT_TYPE: Readonly<Record<DeliveryFormat, string>> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};
/** The delivery key grammar: opaque key + stored extension (see header). */
const DELIVERY_KEY_PATTERN = /^([A-Za-z0-9_-]{22,64})\.(avif|webp|jpeg)$/;

/** The parsed delivery key. */
export interface DeliveryKey {
  /** The opaque key, exactly as `chapter_page.asset_key` / `cover_asset_key`. */
  readonly assetKey: AssetKey;
  /** The stored variant, taken from the key, never from the request. */
  readonly format: DeliveryFormat;
}

/**
 * Parses the path key. `null` ⇒ the caller must 404 (never 422: an unguessable
 * key is a capability, and telling a prober "that is not even a key" is a
 * free oracle — API_CONTRACT §2.1 validation row).
 */
export function parseDeliveryKey(raw: string): DeliveryKey | null {
  const match = DELIVERY_KEY_PATTERN.exec(raw);
  if (match === null) return null;
  return { assetKey: match[1] as AssetKey, format: match[2] as DeliveryFormat };
}

/* ── dependencies ────────────────────────────────────────────────────────── */

/**
 * The port plus the adapter's per-call abort seam. The declared
 * `ObjectStoragePort.getStream` takes one argument; the adapter accepts an
 * optional second one (see `StorageCallOptions`), and widening a method with
 * OPTIONAL parameters keeps the port type satisfied.
 */
export interface MediaStorage extends ObjectStoragePort {
  getStream(
    key: AssetKey,
    options?: StorageCallOptions,
  ): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string; byteLength: number }>;
}

/** Everything {@link deliverPage} needs; injected so the route stays thin. */
export interface MediaDeliveryDeps {
  /** The S3 adapter (ADR-004). */
  readonly storage: MediaStorage;
  /** The database handle — the asset index lives in PostgreSQL. */
  readonly db: Db;
  /**
   * The request's raw `Cookie` header. The draft rule needs the caller's ROLE
   * (API_CONTRACT §2.1 "draft keys 404 for non-admins"); the cookie is the
   * only identity source (ADR-006, THREAT T-04). Absent ⇒ anonymous.
   */
  readonly cookieHeader?: string | undefined;
  /** Aborts the origin fetch when the client disconnects. */
  readonly signal?: AbortSignal | undefined;
  /** Correlates the failure line (OBSERVABILITY.md §3). */
  readonly requestId?: string | undefined;
  /** Optional: without it the module stays silent (tests, scripts). */
  readonly logger?: Logger | undefined;
}

/* ── the asset index lookup ──────────────────────────────────────────────── */

/** What the index says about a key, before any storage call. */
type ResolvedAsset =
  | {
      readonly kind: 'page';
      readonly chapterId: string;
      readonly objectKey: AssetKey;
      /** Not visible to the public (draft chapter, or hidden manga). */
      readonly restricted: boolean;
      readonly notFoundCode: ErrorCode;
    }
  | {
      readonly kind: 'cover';
      readonly objectKey: AssetKey;
      readonly restricted: boolean;
      readonly notFoundCode: ErrorCode;
    };

/**
 * Resolves the opaque key to its physical object, or `null` when nothing in
 * the index claims it.
 *
 * Query shape and why it is acceptable here:
 * 1. `chapter_page` by `asset_key` — the unique index `ix_pages_asset_key`
 *    (DATA_MODEL §10; the hot path SECURITY §7 names). 1 indexed lookup.
 * 2. `chapter` by PK, `manga` by PK — PK lookups, 2 indexed lookups.
 * 3. `manga` by `cover_asset_key` ONLY when the page lookup missed, and with
 *    `LIMIT 1`. ⚠ DATA_MODEL §3 documents no index on `manga.cover_asset_key`,
 *    so this leg is a sequential scan; the T-PERF-004 EXPLAIN gate would flag
 *    it above 10k rows. It is bounded to the cover path (never paid by page
 *    delivery), the result is immutable and cached for a year downstream, and
 *    the fix is a schema change this task's write scope forbids
 *    (`drizzle/**`). spec-question for the schema owner (T-FOUND-006) +
 *    T-PERF-004: add `ix_manga_cover_asset_key`.
 *
 * The queries are written through the Drizzle *relational* API with the
 * operators handed to the callback, so this module imports no SQL helper
 * package (rule D2) and every value stays a bind parameter (NFR-SEC-015).
 *
 * Requirements: NFR-SEC-015, NFR-PERF-014, SECURITY.md §7.
 * Tasks: T-CATALOG-010.
 */
async function resolveAsset(db: Db, key: DeliveryKey): Promise<ResolvedAsset | null> {
  const page = await db.query.chapterPage.findFirst({
    where: (fields, { eq }) => eq(fields.assetKey, key.assetKey),
    columns: { chapterId: true },
  });

  if (page !== undefined) {
    const row = await db.query.chapter.findFirst({
      where: (fields, { eq }) => eq(fields.id, page.chapterId),
      columns: { id: true, mangaId: true, status: true, deletedAt: true },
    });
    // A page row whose chapter is gone cannot happen (FK CASCADE) but must not
    // become a 500 if it ever does.
    if (row === undefined) return null;
    const owner = await db.query.manga.findFirst({
      where: (fields, { eq }) => eq(fields.id, row.mangaId),
      columns: { id: true, published: true, deletedAt: true },
    });
    const restricted =
      row.status !== 'published' ||
      row.deletedAt !== null ||
      owner === undefined ||
      // The manga visibility rule is defined ONCE, in features/manga. This is a
      // call into it, not a second copy of the predicate (T-CATALOG-001).
      !isMangaVisible(owner);
    return {
      kind: 'page',
      chapterId: row.id,
      objectKey: pageObjectKey(row.id, key.assetKey, key.format),
      restricted,
      notFoundCode: 'CHAPTER_NOT_FOUND',
    };
  }

  // Cover leg — see the header: unindexed, bounded, and a recorded gap.
  const cover = await db.query.manga.findFirst({
    where: (fields, { eq }) => eq(fields.coverAssetKey, key.assetKey),
    columns: { id: true, published: true, deletedAt: true },
  });
  if (cover === undefined) return null;
  return {
    kind: 'cover',
    objectKey: coverObjectKey(cover.id, key.assetKey, key.format),
    restricted: !isMangaVisible(cover), // one definition, in features/manga
    notFoundCode: 'MANGA_NOT_FOUND',
  };
}

/* ── responses ───────────────────────────────────────────────────────────── */

function jsonResponse(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/**
 * The §1 error envelope, built from the frozen mapping table only — never from
 * a cause, a vendor message, or a key (NFR-SEC-010, T-13).
 */
function errorResponse(error: AppError, requestId: string, headers: Record<string, string>): Response {
  const mapped = toRouteError(error, requestId);
  return jsonResponse(mapped.httpStatus, mapped.body, {
    'x-content-type-options': 'nosniff',
    'cache-control': MEDIA_ERROR_CACHE_CONTROL,
    ...headers,
  });
}

/** 404: no asset metadata, nothing that says whether a key once existed. */
function notFoundResponse(code: ErrorCode, requestId: string): Response {
  return errorResponse(new AppError(code), requestId, {
    'cache-control': MEDIA_NOT_FOUND_CACHE_CONTROL,
  });
}

/** 502: retry-friendly (Retry-After), never cached, never explained. */
function storageErrorResponse(requestId: string, logger: Logger | undefined): Response {
  logger?.error(
    { requestId, route: '/media/[assetKey]', code: 'STORAGE_ERROR' },
    'media delivery: storage unavailable',
  );
  return errorResponse(new AppError('STORAGE_ERROR'), requestId, {
    'retry-after': MEDIA_RETRY_AFTER_SECONDS,
  });
}

/* ── the delivery entry point ────────────────────────────────────────────── */

/**
 * Delivers one page/cover variant.
 *
 * @param assetKey the raw path segment (still URL-encoded by the framework).
 * @param deps the injected storage/db/caller context.
 * @returns a 200 byte stream, a 404, a 502, or a 500 — never an exception.
 *
 * Requirements: FR-MEDIA-001/002/003, NFR-PERF-013, NFR-SEC-010, THREAT T-11.
 * Task: T-CATALOG-010. Tests: INT-MEDIA-001.
 */
export async function deliverPage(assetKey: string, deps: MediaDeliveryDeps): Promise<Response> {
  const requestId = deps.requestId ?? 'unknown';

  // 1. Grammar gate — no I/O, so a malformed key is a cheap 404 even while the
  //    origin is down (API_CONTRACT §2.1 validation row).
  const key = parseDeliveryKey(assetKey);
  if (key === null) return notFoundResponse('MANGA_NOT_FOUND', requestId);

  // 2. Asset index — one indexed lookup for a page key, a bounded cover leg
  //    after that (SECURITY.md §7; see the header's query note) — and 3. the
  //    draft rule, which is a second indexed read of the session. Both are
  //    database work, so both share one failure answer: the §6 500. A database
  //    outage is not a storage outage and has no §6 code of its own (see the
  //    ConfigurationError note in server/db/client.ts), so INTERNAL_ERROR — the
  //    table's own "unhandled" row — is the mapping.
  let asset: ResolvedAsset | null;
  let visible: boolean;
  try {
    asset = await resolveAsset(deps.db, key);
    visible =
      asset === null ||
      !asset.restricted ||
      (await callerIsAdmin(deps.db, deps.cookieHeader));
  } catch (cause) {
    deps.logger?.error(
      { requestId, route: '/media/[assetKey]', code: 'INTERNAL_ERROR' },
      'media delivery: asset index lookup failed',
    );
    return errorResponse(new AppError('INTERNAL_ERROR', { cause }), requestId, {});
  }

  // 3. Unknown key ⇒ 404. Draft/restricted ⇒ 404 unless the caller is an admin
  //    (API_CONTRACT §2.1 authz row, THREAT T-11). An unknown key and a
  //    restricted one are indistinguishable from outside: same status, same
  //    body shape, same short cache lifetime.
  if (asset === null) return notFoundResponse('MANGA_NOT_FOUND', requestId);
  if (!visible) return notFoundResponse(asset.notFoundCode, requestId);

  // 4. Stream. Nothing is buffered: the response body IS the origin stream.
  let opened: Awaited<ReturnType<MediaStorage['getStream']>>;
  try {
    opened = await deps.storage.getStream(asset.objectKey, { signal: deps.signal });
  } catch (cause) {
    if (cause instanceof ObjectNotFoundError) {
      // The index says it exists but the origin does not have it: a partial
      // ingest or a purged object. Same answer as an unknown key — 404.
      return notFoundResponse(asset.notFoundCode, requestId);
    }
    return storageErrorResponse(requestId, deps.logger);
  }

  const expectedType = FORMAT_CONTENT_TYPE[key.format];
  if (opened.contentType !== expectedType) {
    // The stored object disagrees with the format its key names. The response
    // is still typed from the KEY (never from the object's own header, which
    // a writer could have set to anything), and the disagreement is a data bug
    // worth a line (T-13: the object key is not logged).
    deps.logger?.warn(
      { requestId, route: '/media/[assetKey]', format: key.format, asset: asset.kind },
      'media delivery: stored content type does not match the stored format',
    );
  }

  return new Response(opened.stream, {
    status: 200,
    headers: {
      'content-type': expectedType,
      'content-length': String(opened.byteLength),
      // Weak on purpose — see the ETag note in the file header.
      etag: `W/"${key.assetKey}.${opened.byteLength}"`,
      'cache-control': MEDIA_CACHE_CONTROL,
      'x-content-type-options': 'nosniff',
      'content-disposition': 'inline',
    },
  });
}
