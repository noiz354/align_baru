/**
 * Assembly: ordered chunks -> seekable master + gap manifest.
 *
 * Where this belongs: server/processing.
 * Specification: docs/media/AUDIO-PIPELINE.md §3, ADR-0009, TASKS.md T-AUDIO-009.
 * Invariants: ordering by sequence (never by arrival time - C7); a gap produces a PARTIAL asset with an
 *   explicit manifest, never a silently continuous file; verification (decodable head/tail, duration
 *   within one chunk interval, non-zero size, recorded hash) happens BEFORE the asset is marked
 *   ASSEMBLED; re-running creates a new attempt and `is_current` moves atomically (C11).
 * Task ownership: T-AUDIO-009.
 */
import type { GapManifestEntry } from "@/shared/contracts/audio";

export interface AssemblyResult {
  readonly masterKey: string;
  readonly durationMs: number;
  readonly gapManifest: readonly GapManifestEntry[];
  readonly partial: boolean;
  readonly ffmpegBuild: string;
}

/** @throws Error("Not implemented: T-AUDIO-009") */
export async function assembleSession(input: { sessionId: string; chunks: readonly import("@/server/db/repositories/recording-chunks").ChunkRow[] }): Promise<AssemblyResult> {
  throw new Error("Not implemented: T-AUDIO-009");
}
