/**
 * UUIDv7 (RFC 9562) - time-ordered identifiers.
 *
 * Where this belongs: server/crypto (no product knowledge, no I/O).
 * Specification: DATA_MODEL.md §Global conventions (primary keys are UUIDv7), ADR-0003.
 *
 * A 48-bit big-endian Unix-millisecond prefix followed by randomness: time-sortable, as the data model
 * requires, without a dependency. The library's `"uuid"` generator produces v4 and loses the ordering
 * property, and STACK-2026 §19 forbids adding a package without a classification.
 *
 * Moved here from `src/server/auth/better-auth.ts` during the 2026-09-27 merge of `main`: that identity
 * factory was superseded by `src/server/auth/auth.ts`, but this helper and its four tests are not part of
 * the duplication, so they kept their home.
 */

/** @param now milliseconds since the epoch; defaults to the current time */
export function uuidV7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const ms = Math.floor(now);
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = (ms / 2 ** 32) & 0xff;
  bytes[2] = (ms / 2 ** 24) & 0xff;
  bytes[3] = (ms / 2 ** 16) & 0xff;
  bytes[4] = (ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
