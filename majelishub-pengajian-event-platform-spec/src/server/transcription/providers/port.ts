/**
 * TranscriptionProvider port - the only place a speech-to-text vendor may appear.
 *
 * Where this belongs: server/transcription/providers. NO provider SDK or type may be imported outside
 *   this directory (lint rule, ADR-0011).
 * Specification: ADR-0011, TRANSCRIPTION.md §3, docs/transcription/PIPELINE.md §3, TASKS.md T-TRANSCRIPT-005.
 * Invariants:
 *   1. Adapters send audio + a job reference ONLY - never participant names, contacts or attendee data.
 *   2. Returned model version and confidence metadata are stored unaltered; text is never "improved".
 *   3. Errors are classified (see TranscriptionProviderError codes) so retry policy is automatic.
 *   4. A hosted adapter cannot even be constructed while egress is disabled (fail fast, no fallback).
 *   5. Output is stored verbatim as revision #1 (ADR-0023) - the port never post-processes text.
 * Task ownership: T-TRANSCRIPT-001/005.
 */
export interface TranscriptionInput {
  readonly audioUrl: string;              // short-lived signed URL to the 16 kHz derivative
  readonly durationMs: number;
  readonly languageHints: readonly string[];
  readonly gapManifest: readonly import("@/shared/contracts/audio").GapManifestEntry[];
  readonly jobReference: string;          // opaque, no personal data
}

export interface TranscriptionOutput {
  readonly segments: readonly { readonly startMs: number; readonly endMs: number; readonly text: string; readonly language?: string; readonly confidence?: number }[];
  readonly language?: string;
  readonly modelVersion: string;
}

export type TranscriptionProviderErrorCode =
  | "PROVIDER_UNAVAILABLE" | "PROVIDER_AUTH" | "PROVIDER_QUOTA" | "PROVIDER_REJECTED_INPUT"
  | "PROVIDER_MALFORMED_OUTPUT" | "PROVIDER_TIMEOUT" | "EGRESS_DISABLED";

export interface TranscriptionProvider {
  readonly id: string;
  supports(languageHints: readonly string[]): boolean;
  submit(input: TranscriptionInput): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<{ status: "QUEUED" | "RUNNING" | "DONE" | "ERROR"; progress?: number }>;
  fetch(providerJobId: string): Promise<TranscriptionOutput>;
}

/** Factory: refuses to build a hosted adapter when TRANSCRIPTION_EGRESS_ENABLED is false. */
/** @throws Error("Not implemented: T-TRANSCRIPT-005") */
export function createProvider(config: { provider: string; egressEnabled: boolean }): TranscriptionProvider {
  throw new Error("Not implemented: T-TRANSCRIPT-005");
}
