/**
 * Audio/recording contracts.
 * Specification: AUDIO.md, docs/media/{CHUNK-PROTOCOL,AUDIO-PIPELINE,STORAGE}.md, ADR-0008/0009.
 * Invariants:
 *   1. A recording session cannot start without an acknowledged policy statement (T-AUDIO-002).
 *   2. Chunk identity is (sessionId, sequence); the same sequence with a different hash is a CONFLICT.
 *   3. Assembly is sequence-ordered; gaps produce a PARTIAL asset with a gap manifest - never a
 *      silently continuous file.
 *   4. The master audio is never mutated; re-processing creates a new version.
 */
export type RecordingPolicy = "NONE" | "INTERNAL" | "PUBLISH_AUDIO" | "PUBLISH_AUDIO_AND_TRANSCRIPT";
export type RecordingSessionState =
  | "IDLE" | "RECORDING" | "PAUSED" | "STOPPING" | "UPLOADED"
  | "ASSEMBLING" | "ASSEMBLED" | "PROCESSING" | "READY" | "PARTIAL" | "FAILED" | "ABANDONED";

export interface ChunkUploadRequest {
  readonly sessionId: string;
  readonly sequence: number;
  readonly durationMs: number;
  readonly hash: string;              // sha256 of the bytes
  readonly capturedAt: string;
  readonly idempotencyKey: string;
}

export interface ChunkUploadResult {
  readonly sequenceAccepted: number;
  readonly acceptedUpTo: number;
  readonly duplicate: boolean;
}

export interface GapManifestEntry {
  readonly afterSequence: number;
  readonly missingCount: number;
  readonly estimatedMs: number;
}
