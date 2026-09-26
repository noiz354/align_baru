/**
 * Page index validation & clamping (the anti-negative/out-of-range guard).
 *
 * Responsibility: every page index entering the reader (deep links,
 * progress API input, internal navigation) passes these pure functions so
 * that negative, zero, out-of-range, non-numeric, or hostile inputs can
 * never reach state or storage (FR-READER-023, THREAT T-18).
 *
 * Requirements: FR-READER-023, NFR-DATA-003, THREAT T-18.
 * Tasks: T-READER-032 (implementation), UNIT-READER-002 (the input table +
 * fuzz), T-READER-021 (progress API uses the 422 path).
 *
 * Two export policies (both pure, same core):
 * - `clampPageIndex` — the READER policy: clamp into [1..M], report whether
 *   a clamp happened (drives the one-time UI notice, reader-behavior §12).
 * - `validatePageIndex` — the API policy: strict — reject with a typed
 *   reason (route maps to 422 READER_INVALID_PAGE). No silent clamping in
 *   the API (writes must be honest).
 *
 * Input grammar (normative, UNIT-READER-002 covers the table):
 * - integers 1..M ⇒ accepted
 * - 0, negatives ⇒ reader: clamp to 1 (+notice) · api: reject
 * - > M ⇒ reader: clamp to M (+notice) · api: reject
 * - non-integer strings ("12.7", "1e2") ⇒ reject (pages are integers;
 *   "12.7" is NOT floored — documented rule)
 * - non-numeric ("abc", "", "  ", "١٢" unicode digits) ⇒ reject
 * - overflow ("99999999999999999999") ⇒ reject (safe parse, no NaN holes)
 * - whitespace-padded ("  12 ") ⇒ accepted (trim) — the ONLY leniency
 *
 * Security notes (T-18):
 * - the result is `number | null` only — no prototype-pollution surface;
 * - never trust the caller's `updated_at` (server stamps, NFR-DATA-003);
 * - invalid input is never stored (the 422 path is terminal).
 */

export type PageIndexRejection =
  | { ok: false; reason: 'not-a-number' }
  | { ok: false; reason: 'below-range' }
  | { ok: false; reason: 'above-range' };

/**
 * TODO(T-READER-032): implement per the grammar above.
 * DO NOT implement during the architecture phase.
 */
export function clampPageIndex(
  candidate: number | string,
  totalPages: number,
): { page: number; clamped: boolean } {
  throw new Error('Not implemented: T-READER-032');
}

/**
 * TODO(T-READER-032): implement per the grammar above.
 */
export function validatePageIndex(
  candidate: number | string,
  totalPages: number,
): { ok: true; page: number } | PageIndexRejection {
  throw new Error('Not implemented: T-READER-032');
}
