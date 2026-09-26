/**
 * Withdrawal and unpublishing of published content (speaker, organizer, moderator).
 *
 * Where this belongs: features/content.
 * Specification: CONTENT.md §10, TASKS.md T-AUDIO-008, THREAT_MODEL T-11/T-15.
 * Invariants: withdrawal is immediate for search and public navigation; the master audio is retained
 *   (deletion only via retention or lawful erasure); requester, reason and time are recorded; an old
 *   link renders a neutral explanation page rather than a 404 or the content; re-publication requires a
 *   fresh review decision (never a toggle).
 * Privacy: explanation text states what was removed without speculating about the person.
 * Concurrency: withdrawal racing with publication approval must not resurrect content; in-flight signed
 *   URLs expire within the TTL (documented residual risk).
 * Task ownership: T-AUDIO-008, T-CONTENT-003.
 */
export interface WithdrawalRequest {
  readonly targetKind: "AUDIO_ASSET" | "TRANSCRIPT" | "MATERIAL";
  readonly targetId: string;
  readonly reason: "SPEAKER_REQUEST" | "MOSQUE_REQUEST" | "MISATTRIBUTION" | "PRIVACY" | "MODERATION" | "OTHER";
  readonly note?: string;
  readonly actor: import("@/shared/contracts/permissions").Actor;
}

/** @throws Error("Not implemented: T-AUDIO-008") */
export async function withdrawContent(request: WithdrawalRequest): Promise<{ withdrawn: true; requiresReviewToRepublish: true }> {
  throw new Error("Not implemented: T-AUDIO-008");
}
