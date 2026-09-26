/**
 * Presigned URL issuance - the ONLY way an object reaches a browser.
 *
 * Where this belongs: server/storage.
 * Specification: docs/media/STORAGE.md §3, ADR-0013, TASKS.md T-AUDIO-008, THREAT_MODEL T-11.
 * Invariants: issued only after a permission check for the specific object; one object per URL; TTL
 *   default 300 s, hard cap 900 s; `Cache-Control: private, no-store` on the API response that returns
 *   it; URLs are never logged, never embedded in a public page before a user action; revocation of
 *   access blocks NEW URLs while existing ones expire within the TTL (documented residual risk).
 * Task ownership: T-AUDIO-008, T-OPS-006.
 */
export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: string;
  readonly objectKey: string;
}

/** @throws Error("Not implemented: T-AUDIO-008") */
export async function signObjectUrl(input: { bucket: "MASTER" | "DERIVED" | "PARTIAL" | "EXPORTS"; key: string; ttlSeconds?: number }): Promise<SignedUrl> {
  throw new Error("Not implemented: T-AUDIO-008");
}
