/**
 * Sandboxed media runner - the only component allowed to execute ffmpeg on user-supplied bytes.
 *
 * Where this belongs: server/processing (media container).
 * Specification: docs/media/AUDIO-PIPELINE.md §3/§4, TASKS.md T-SEC-005 / T-AUDIO-009/010.
 * Invariants:
 *   1. Non-root user, read-only root filesystem, bounded CPU/memory/time, no network by default.
 *   2. Input must have passed validation (magic bytes + container sanity) before ffmpeg sees it.
 *   3. No database credentials beyond the job it was handed; outputs are written to storage via the
 *      worker, not by reaching into application tables.
 *   4. The ffmpeg build string is recorded on the produced asset (reproducibility).
 *   5. Refusals are explicit: a malformed input fails the job with a classification, never a partial
 *      "best effort" output presented as complete.
 * Task ownership: T-SEC-005, T-AUDIO-009/010, T-OPS-002.
 */
export interface MediaCommand {
  readonly operation: "PROBE" | "ASSEMBLE" | "NORMALIZE" | "DERIVE_16K" | "PEAKS";
  readonly inputs: readonly { readonly storageKey: string }[];
  readonly outputKey?: string;
  readonly limits: { readonly timeoutSeconds: number; readonly cpuSeconds: number; readonly maxBytes: number };
}

export interface MediaResult {
  readonly operation: MediaCommand["operation"];
  readonly durationMs: number;
  readonly output?: { readonly key: string; readonly bytes: number; readonly sha256: string };
  readonly probe?: { readonly durationMs: number; readonly codec: string; readonly sampleRateHz: number; readonly channels: number };
}

/** @throws Error("Not implemented: T-AUDIO-009") */
export async function runMediaCommand(command: MediaCommand): Promise<MediaResult> {
  throw new Error("Not implemented: T-AUDIO-009");
}
