/**
 * Hosted transcription adapters (OPTIONAL, egress-gated, disabled by default).
 *
 * Where this belongs: server/transcription/providers.
 * Specification: ADR-0011, PRIVACY.md §5 (processor table), TASKS.md T-TRANSCRIPT-005.
 * Invariants:
 *   1. Constructing a hosted adapter while egress is disabled throws - no silent fallback, no retry-loop
 *      that would eventually send data.
 *   2. Enabling egress requires: the processor documented in PRIVACY.md, a decision record, and the
 *      container egress allow-list updated to that provider host only.
 *   3. Only the 16 kHz derivative plus a job reference is sent - never names, contacts or event data.
 *   4. Audio is deleted from the provider per the provider's retention policy, which must be known and
 *      recorded before enabling (unknown retention = blocked).
 * Task ownership: T-TRANSCRIPT-005.
 */
export const HOSTED_PROVIDER_REQUIREMENTS = [
  "processor entry in PRIVACY.md (categories, purpose, region, retention)",
  "decision record (ADR) naming the provider",
  "egress allow-list entry for the provider host only",
  "known and recorded provider retention behaviour",
] as const;

/** @throws Error("Not implemented: T-TRANSCRIPT-005") */
export function createHostedProvider(providerId: string): import("./port").TranscriptionProvider {
  throw new Error("Not implemented: T-TRANSCRIPT-005");
}
