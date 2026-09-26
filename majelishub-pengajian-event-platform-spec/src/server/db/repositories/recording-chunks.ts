/**
 * Recording chunk repository - the durable record of what the server has accepted.
 *
 * Where this belongs: server/db/repositories.
 * Specification: docs/media/CHUNK-PROTOCOL.md §3/§5, TASKS.md T-AUDIO-004.
 * Invariants:
 *   1. `UNIQUE (session_id, sequence)`; identical hash => duplicate success; different hash => CONFLICT
 *      (never an overwrite).
 *   2. A row is written only after the object exists in storage (success means durable).
 *   3. `acceptedUpTo` is computed from the sequence set, not from a counter that could drift.
 *   4. Assembly reads ordered rows and produces a gap manifest instead of pretending continuity.
 * Task ownership: T-AUDIO-004, T-AUDIO-009.
 */
export interface ChunkRow {
  readonly sessionId: string;
  readonly sequence: number;
  readonly bytes: number;
  readonly durationMs: number;
  readonly hash: string;
  readonly storageKey: string;
  readonly acceptedAt: string;
}

export interface RecordingChunkRepository {
  insertIfAbsent(row: ChunkRow): Promise<{ inserted: boolean; existingHash: string }>;
  listOrdered(sessionId: string): Promise<readonly ChunkRow[]>;
  acceptedUpTo(sessionId: string): Promise<number>;
}

/** @throws Error("Not implemented: T-AUDIO-004") */
export function recordingChunkRepository(scope: import("@/shared/contracts/scope").TenantScope): RecordingChunkRepository {
  throw new Error("Not implemented: T-AUDIO-004");
}
