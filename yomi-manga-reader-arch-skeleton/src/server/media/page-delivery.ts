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
 * - Unknown / draft / deleted keys ⇒ 404 MEDIA_NOT_FOUND (cheap single
 *   lookup; enumeration is safe by design — T-11).
 * - Storage failures ⇒ 502 STORAGE_ERROR — vendor XML NEVER passes
 *   through (NFR-SEC-010).
 * - Streaming only: no full-object buffering in Node (PERFORMANCE §4).
 * - Immutable per key: content per key never changes (re-ingest = new
 *   keys) — what makes the 1-year cache safe (NFR-PERF-013).
 *
 * TODO(T-CATALOG-010): deliverPage(assetKey, storage, db) → Response.
 */
export function deliverPage(assetKey: string): Promise<Response> {
  throw new Error('Not implemented: T-CATALOG-010 (page delivery)');
}
