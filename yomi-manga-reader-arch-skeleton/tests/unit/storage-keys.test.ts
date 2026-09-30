/**
 * Unit tests — the delivery-URL rule: one key, one place (T-CATALOG-010).
 *
 * Canonical plan: TEST_STRATEGY.md §2/§3 has no `*MEDIA*` unit row — §7
 * requires a test not in that document to be added to it first, and the
 * document is outside this task's write scope, so the ID below is minted
 * under the task's own naming (the same convention
 * `tests/unit/seed.harness.test.ts` uses for UNIT-SEED-*) and is reported
 * as a spec-question for the document owner.
 *
 * Requirements: FR-MEDIA-003, ADR-005. Task: T-CATALOG-010.
 *
 * Why this file exists
 * --------------------
 * The delivery grammar (`DELIVERY_KEY_PATTERN` in
 * src/server/media/page-delivery.ts) accepts `/media/{key}.{variant}` only,
 * but the repositories built `/media/{key}` with no extension — and all three
 * page variants shared that one extensionless URL, on the theory that the
 * route negotiates the format from `Accept`. ADR-005 says the opposite ("no
 * runtime negotiation server-side — `<picture>` picks the variant"), so every
 * reader `<img>` was a 404. The URL rule now lives in exactly one function,
 * `mediaUrlFor` in src/shared/storage-keys.ts, next to the object-key rules
 * it mirrors — and these tests pin the shape the delivery layer parses.
 */
import { describe, expect, it } from 'vitest';
import { mediaUrlFor } from '../../src/shared/storage-keys';
import { parseDeliveryKey } from '../../src/server/media/page-delivery';

// A fixed 32-hex base key: the shape `pageAssetKey` mints, written out so the
// expectations below are literals, not recomputations of the code under test.
const KEY = '61701ccac2e4b37271156b8cfae93159';

describe('UNIT-MEDIA-001 / T-CATALOG-010 — the delivery URL carries the variant', () => {
  it('builds one distinct URL per variant from the same base key', () => {
    expect(mediaUrlFor(KEY, 'jpeg')).toBe(`/media/${KEY}.jpeg`);
    expect(mediaUrlFor(KEY, 'webp')).toBe(`/media/${KEY}.webp`);
    expect(mediaUrlFor(KEY, 'avif')).toBe(`/media/${KEY}.avif`);
  });

  it('every URL it builds parses under the delivery grammar, with the right variant', () => {
    for (const format of ['avif', 'webp', 'jpeg'] as const) {
      const parsed = parseDeliveryKey(mediaUrlFor(KEY, format).replace('/media/', ''));
      expect(parsed).not.toBeNull();
      expect(parsed?.assetKey).toBe(KEY);
      expect(parsed?.format).toBe(format);
    }
  });

  it('keeps the URL app-relative: never a storage URL, never a path', () => {
    const url = mediaUrlFor(KEY, 'jpeg');
    expect(url.startsWith('/media/')).toBe(true);
    expect(url).not.toContain('pages/');
    expect(url).not.toContain('covers/');
    expect(url.slice('/media/'.length)).not.toContain('/');
  });
});
