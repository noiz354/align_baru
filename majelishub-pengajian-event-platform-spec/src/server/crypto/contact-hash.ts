/**
 * Keyed contact hashing (dedupe without enabling a dictionary attack).
 *
 * Where this belongs: server/crypto.
 * Specification: TASKS.md T-REG-011, PRIVACY.md §4, THREAT_MODEL T-07.
 * Invariants: HMAC-style keyed hash with a versioned salt (rotation supported via re-hash migration);
 *   the hash is used only for dedupe and abuse limits, never as an identifier in analytics; the raw
 *   value lives in the narrow contact table with its own permissions and retention.
 * Task ownership: T-REG-011.
 */
export interface ContactHashResult {
  readonly hash: string;
  readonly saltVersion: number;
}

/** @throws Error("Not implemented: T-REG-011") */
export function hashContact(input: { kind: "EMAIL" | "PHONE"; normalisedValue: string; saltVersion: number }): ContactHashResult {
  throw new Error("Not implemented: T-REG-011");
}
