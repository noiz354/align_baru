/**
 * Identifier vocabulary. IDs are opaque ULIDs generated server-side.
 *
 * Invariants: never reuse an id; never expose a raw database id in a QR payload (ADR-0006); never use
 * an email/phone as an identifier (privacy by construction).
 * Note: ULID monotonicity is convenient for cursor pagination but is NOT a security boundary.
 */
export type Ulid = string;
export type OpaqueToken = string; // MAJ-XXXX-XXXX-XXXX-XXXX, never logged, never stored in plaintext
export type ShortCode = string;   // human-entered fallback, separate secret, rate-limited
export type Slug = string;        // public URLs only; never a primary key
