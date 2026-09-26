/**
 * Upload validation shared by audio chunks, materials and any future upload.
 *
 * Where this belongs: features/media/validation; called by every upload path before storage or ffmpeg.
 * Specification: TASKS.md T-SEC-005, docs/media/STORAGE.md §1, THREAT_MODEL T-10.
 * Invariants: magic-byte sniffing (an extension is not evidence); size caps; container sanity; filenames
 *   never become keys; a rejected upload leaves no object behind and enqueues no job.
 * Security: the media runner never sees unvalidated bytes; it runs non-root, without network access,
 *   with bounded CPU/memory/time.
 * Failure cases: unknown type · wrong magic bytes · truncated container · oversized · decompression bomb
 *   · unsupported codec - each with a distinct error code and no processing attempt.
 * Task ownership: T-SEC-005, T-AUDIO-004.
 */
export type ValidationVerdict =
  | { readonly ok: true; readonly contentType: string; readonly sniffedKind: "WEBM_OPUS" | "OGG_OPUS" | "WAV" | "PDF" | "IMAGE" | "CSV" }
  | { readonly ok: false; readonly code: "CHUNK_TOO_LARGE" | "CHUNK_VALIDATION_FAILED" | "SESSION_LIMIT_EXCEEDED"; readonly detail: string };

/** @throws Error("Not implemented: T-SEC-005") */
export function validateUpload(input: { bytes: Uint8Array; declaredContentType: string; kind: "AUDIO_CHUNK" | "MATERIAL"; sessionBytesSoFar?: number }): ValidationVerdict {
  throw new Error("Not implemented: T-SEC-005");
}
