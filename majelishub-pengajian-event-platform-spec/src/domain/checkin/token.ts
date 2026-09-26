/**
 * Check-in token generation and parsing (the token is the credential; this file is security-critical).
 *
 * Where this belongs: `src/domain/checkin/` - pure, no I/O, fully testable.
 * Specification: ADR-0006 (opaque 128-bit base32 token, SHA-256 stored, no PII), docs/security/QR-SECURITY.md.
 *
 * Invariants (each has a dedicated test; a failure is a release blocker):
 *   1. Alphabet: Crockford-style base32 without ambiguous characters (I, L, O, U excluded).
 *   2. Format: `MAJ-XXXX-XXXX-XXXX-XXXX`; fixed length; no whitespace, URL scheme or query markers.
 *   3. Entropy: >= 128 bits from a CSPRNG. No time, no counter, no entity id, no personal data.
 *   4. Uniqueness: enforced by a unique index; a collision must regenerate, never lengthen the token.
 *   5. Storage: only SHA-256(token) is persisted; comparison is constant-time; the value is never logged
 *      (T-SEC-004 bans token fields by name).
 * Task ownership: T-CHECKIN-003 (payload properties), T-CHECKIN-011 (entropy/revocation).
 */
export const TOKEN_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U
export const TOKEN_PATTERN = /^MAJ-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
export const TOKEN_GROUPS = 4;
export const TOKEN_GROUP_SIZE = 4;
export const TOKEN_ENTROPY_BITS = 128;

export interface TokenService {
  /** Generate a token from a CSPRNG. Never derived from any entity value. */
  generate(): string;
  /** Strict parse. Returns null for anything that is not exactly a token (no partial acceptance). */
  parse(candidate: string): { token: string } | null;
  /** SHA-256 hex digest used for lookups. Never compare digest strings with `===` in security paths. */
  hash(token: string): string;
  /** Short display prefix for support ("MAJ-7Q2K..."), safe to show and store. */
  displayPrefix(token: string): string;
}

/** @throws Error("Not implemented: T-CHECKIN-003") */
export function tokenService(): TokenService {
  throw new Error("Not implemented: T-CHECKIN-003");
}
