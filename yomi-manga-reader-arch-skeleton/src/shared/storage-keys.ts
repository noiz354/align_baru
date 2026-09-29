/**
 * Object-key rules (ADR-004 bucket layout, DATA_MODEL §10/§3).
 *
 * This module is the ONLY place a physical object key is built — moved here
 * from `server/storage/object-storage.ts` in F-017-S1, verbatim, for one
 * reason: these are pure string rules with no infrastructure in them, and the
 * ingest service (`features/uploads`) needs the same rule the delivery layer
 * reads by. D1 forbids `features/*` from importing `server/*`, so a rule both
 * sides need lives in `shared/` — one implementation, two importers. The sister
 * module re-exports them, so existing server imports keep working and no second
 * copy of the rule exists anywhere.
 *
 * Requirements: NFR-SEC-010, FR-MEDIA-003. Tasks: T-CATALOG-010, T-UPLOAD-005.
 */
import { AppError } from './contracts/errors';
import type { DeliveryFormat } from './contracts/ports';
import type { AssetKey } from './types';

/** The opaque key shape FR-MEDIA-003 mandates: 128-bit random, base64url. */
const ASSET_KEY_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

/** Row ids are uuids (DATA_MODEL.md conventions); anything else is a bug. */
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** The stored extension per delivery format (ADR-005 ladder). */
const FORMAT_EXTENSION: Readonly<Record<DeliveryFormat, string>> = {
  avif: 'avif',
  webp: 'webp',
  jpeg: 'jpeg',
};

/**
 * Fail-fast invariant check — NOT input validation. Both arguments are
 * server-owned (a DB row id, a generated key), so a violation is a broken
 * invariant and INTERNAL_ERROR (500) says exactly that. No client-supplied
 * value ever reaches here: the delivery layer validates the URL key first, so
 * a crafted path can never become an object key (NFR-SEC-010).
 *
 * Requirements: NFR-SEC-010. Tasks: T-CATALOG-010.
 */
function requireKeyPart(value: string, pattern: RegExp, subject: string): string {
  if (!pattern.test(value)) {
    throw new AppError('INTERNAL_ERROR', {
      cause: new Error(`refusing to build an object key: ${subject} is not well formed`),
    });
  }
  return value;
}

/**
 * Physical key of one page variant: `pages/{chapterId}/{assetKey}.{ext}`
 * (ADR-004 bucket layout, DATA_MODEL §10).
 *
 * @param chapterId owning chapter row id (never a client value).
 * @param assetKey the opaque key stored in `chapter_page.asset_key`.
 * @param format the stored variant (ADR-005 ladder).
 */
export function pageObjectKey(
  chapterId: string,
  assetKey: string,
  format: DeliveryFormat,
): AssetKey {
  requireKeyPart(chapterId, UUID_PATTERN, 'chapterId');
  requireKeyPart(assetKey, ASSET_KEY_PATTERN, 'assetKey');
  return `pages/${chapterId}/${assetKey}.${FORMAT_EXTENSION[format]}` as AssetKey;
}

/**
 * Physical key of one cover variant: `covers/{mangaId}.{ext}` (ADR-004,
 * DATA_MODEL §3). Covers are WebP + JPEG only (ADR-005 / T-UPLOAD-011).
 *
 * @param mangaId owning manga row id.
 * @param assetKey the opaque key stored in `manga.cover_asset_key`.
 * @param format the stored variant.
 */
export function coverObjectKey(
  mangaId: string,
  assetKey: string,
  format: DeliveryFormat,
): AssetKey {
  requireKeyPart(mangaId, UUID_PATTERN, 'mangaId');
  requireKeyPart(assetKey, ASSET_KEY_PATTERN, 'assetKey');
  return `covers/${mangaId}.${FORMAT_EXTENSION[format]}` as AssetKey;
}
