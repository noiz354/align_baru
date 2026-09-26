/**
 * Token grammar helpers - a thin, dependency-free layer used by the scanner client and the server.
 *
 * Where this belongs: `src/domain/checkin/`.
 * Why it is separate from `token.ts`: the client must reject a non-MajelisHub QR **before** any network
 * call (a poster QR, a Wi-Fi QR or a phishing QR must produce zero server traffic - docs/security/
 * QR-SECURITY.md §3), and the client bundle must not pull in the hashing/generation code.
 * Task ownership: T-CHECKIN-001 (validation), T-CHECKIN-003 (payload rules).
 */
import { TOKEN_PATTERN } from "./token";

/** Fast, allocation-light grammar check. Returns false for empty/oversized input. */
export function looksLikeToken(candidate: string): boolean {
  // Grammar only - deliberately implemented as a pure predicate because it is used on every scan.
  const maxLength = 4 + 1 + (4 * 5); // MAJ- + 4 groups of 4 with separators
  return candidate.length <= maxLength && TOKEN_PATTERN.test(candidate);
}

/**
 * Normalise user-typed short codes (whitespace, dashes, accidental lowercase).
 * Must never be applied to a scanned token before hashing (a normalised token is a different secret).
 * @throws Error("Not implemented: T-CHECKIN-004")
 */
export function normaliseShortCode(input: string): string {
  throw new Error("Not implemented: T-CHECKIN-004");
}
