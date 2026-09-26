/**
 * server/storage — ObjectStoragePort implementation (S3 protocol).
 *
 * Responsibility: the S3 adapter (R2 / AWS S3 / MinIO behind one port —
 * ADR-004): streaming put/get (NEVER buffer whole objects), head/exists/
 * delete, multipart presign (server-internal, exact-key scoped, 15 min),
 * the readyz canary (DEPLOYMENT.md §4), and staging lifecycle support.
 *
 * Requirements: ADR-004, FR-MEDIA-003 (private bucket, no layout leak),
 * NFR-SEC-009/010, THREAT T-11/T-13.
 * Tasks: T-UPLOAD-005 (variant writes), T-CATALOG-010 (delivery stream),
 * T-UPLOAD-008 (presign), T-OBS-004 (canary).
 *
 * Rules:
 * - ONLY module allowed to import @aws-sdk/* (rule D3).
 * - Keys are opaque to this module (layout constants live here —
 *   pages/{chapterId}/{key}.{ext}, covers/{mangaKey}.{ext},
 *   staging/{jobId}/ — ADR-004; features never see them).
 * - Streaming: getStream returns a ReadableStream directly from the SDK;
 *   no intermediate buffer (PERFORMANCE.md §4).
 * - Errors map to STORAGE_ERROR (502) — vendor XML never passes through
 *   (NFR-SEC-010; THREAT T-11 verification).
 * - Credentials from Env only (T-13); no secrets in logs.
 *
 * TODO(T-UPLOAD-005): createObjectStorage(env) → ObjectStoragePort.
 */
export function createObjectStorage(/* env: Env */): unknown {
  throw new Error('Not implemented: T-UPLOAD-005 (S3 adapter)');
}
