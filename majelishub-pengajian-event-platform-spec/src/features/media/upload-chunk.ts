/**
 * Chunk upload acceptance (server side of the chunk protocol).
 *
 * Where this belongs: features/media, exposed by POST /api/v1/recordings/{sessionId}/chunks (API-031).
 * Specification: docs/media/CHUNK-PROTOCOL.md, ADR-0008, ADR-0015, TASKS.md T-AUDIO-004.
 * Invariants: success means the bytes are durable in storage AND the row committed; (sequence, hash)
 *   idempotent; same sequence with a different hash is CHUNK_SEQUENCE_CONFLICT (never an overwrite);
 *   `acceptedUpTo` is the client's reconciliation primitive; object keys derive from ids only.
 * Security: server-side validation (T-SEC-005) before any processing; size caps per chunk and session;
 *   the key includes session and tenant so one session cannot overwrite another's objects.
 * Privacy: chunk metadata carries no personal data; the buckets are private.
 * Concurrency: C7 (out-of-order arrival) and C8 (duplicate upload).
 * Failure cases: network abort (client retries) · storage failure (no row written, retryable) ·
 *   oversized · malformed container · session already assembled · quota exhausted.
 * Task ownership: T-AUDIO-004.
 */
import type { ChunkUploadRequest, ChunkUploadResult } from "@/shared/contracts/audio";

/** @throws Error("Not implemented: T-AUDIO-004") */
export async function acceptChunk(input: { request: ChunkUploadRequest; bytes: Uint8Array; scope: import("@/shared/contracts/scope").TenantScope }): Promise<ChunkUploadResult> {
  throw new Error("Not implemented: T-AUDIO-004");
}
