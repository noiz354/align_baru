/**
 * Self-hosted Whisper large-v3 adapter (the DEFAULT provider).
 *
 * Where this belongs: server/transcription/providers (the only place provider specifics live).
 * Specification: docs/research/STACK-2026.md §12 (MIT licence; ~15-16% WER on hard audio; no
 *   code-switching support; hallucinates over silence -> hence the gap manifest), ADR-0011.
 * Deployment: runs inside the deployment (no egress), typically on the worker or a dedicated container;
 *   CPU-only transcription is a nightly batch pattern, GPU reduces a 2-hour file to minutes.
 * Invariants: no network access needed; the adapter still obeys the port contract and never edits text.
 * Task ownership: T-TRANSCRIPT-001, T-OPS-002 (media/worker containers).
 */
export const SELF_HOSTED_WHISPER_MODEL = "whisper-large-v3";
export const SELF_HOSTED_WHISPER_LIMITATIONS = [
  "no reliable Indonesian-Arabic code-switching",
  "hallucinates fluent text over silence (mitigated by the gap manifest)",
  "CPU-only runs are slow: keep it out of the event-day critical path",
] as const;

/** @throws Error("Not implemented: T-TRANSCRIPT-001") */
export function createSelfHostedWhisperProvider(): import("./port").TranscriptionProvider {
  throw new Error("Not implemented: T-TRANSCRIPT-001");
}
