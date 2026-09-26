/**
 * Authorized access to recordings (playback, download, review player).
 *
 * Where this belongs: features/audio; signing happens in src/server/storage/signing.ts.
 * Specification: TASKS.md T-AUDIO-008, ADR-0013, THREAT_MODEL T-11.
 * Invariants: a signed URL is issued only after a permission check on the specific asset; INTERNAL
 *   policy yields no player outside authorized roles; signed URLs are short-lived (<= 900 s) and are
 *   never logged or embedded in HTML before a user action; withdrawal flips the permission so new URLs
 *   cannot be issued (existing URLs expire within the TTL - documented residual risk).
 * Privacy: playback of a withdrawal-requested item must not be implicitly allowed by a cached URL.
 * Failure cases: asset not READY · asset PARTIAL (playable with the gap disclosed) · storage outage ·
 *   expired URL (the player re-requests).
 * Task ownership: T-AUDIO-008, T-AUDIO-011.
 */
export interface SignedPlayback {
  readonly url: string;
  readonly expiresAt: string;
  /** Provenance shown next to the player (gap manifest, policy, processing config version). */
  readonly disclosure?: string;
}

/** @throws Error("Not implemented: T-AUDIO-008") */
export async function requestPlaybackUrl(input: { assetId: string; purpose: "PLAY" | "DOWNLOAD" | "REVIEW"; actor: import("@/shared/contracts/permissions").Actor }): Promise<SignedPlayback> {
  throw new Error("Not implemented: T-AUDIO-008");
}
