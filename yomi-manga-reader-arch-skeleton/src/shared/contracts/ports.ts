/**
 * Infrastructure ports — non-DB capabilities.
 *
 * Ports are the ONLY way features/admin touch infrastructure
 * (module-boundaries.md §1). Implementations live exclusively in server/
 * (dependency rules D2–D4). The composition root (server/composition.ts)
 * is the only wiring point.
 *
 * Requirements: ADR-004 (storage), ADR-005 (media), ADR-008 (telemetry).
 * Tasks: T-UPLOAD-005 (storage use), T-UPLOAD-004 (media use), T-OBS-001/002.
 */
import type { AssetKey } from '../types';

/**
 * S3-protocol object storage (ADR-004).
 * Invariants:
 * - `key` is opaque to this port (layout is server/storage's business;
 *   features never see paths — NFR-SEC-010).
 * - Buckets are private; no public URLs are produced here (delivery is
 *   app-mediated, FR-MEDIA-003; presign is server-internal only).
 * - Streaming: get() returns a stream; implementations MUST NOT buffer
 *   whole objects in memory (PERFORMANCE.md §4).
 *
 * TODO(T-UPLOAD-005): implementation in server/storage (S3 SDK adapter).
 */
export interface ObjectStoragePort {
  /** Put an object from a stream. Idempotent per key (immutable keys). */
  putStream(
    key: AssetKey,
    stream: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
    contentType: string,
  ): Promise<void>;
  /** Stream an object out (delivery). 404 ⇒ NOT_FOUND error (typed). */
  getStream(key: AssetKey): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string; byteLength: number }>;
  /** Existence check (canary, reconciliation). */
  exists(key: AssetKey): Promise<boolean>;
  /** Delete (GC of replaced/deleted assets — T-UPLOAD-009). */
  delete(key: AssetKey): Promise<void>;
  /** Head metadata (delivery Content-Length, canary). */
  head(key: AssetKey): Promise<{ contentType: string; byteLength: number } | null>;
  /**
   * Multipart/presigned part upload (FR-UPLOAD-008).
   * URLs are short-lived, exact-key scoped, PUT-only (T-13: never leaked
   * beyond the admin client's own session).
   */
  presignPartUpload(key: AssetKey, partNumber: number, partSizeBytes: number): Promise<string>;
}

/** Delivery format ladder (ADR-005, FR-MEDIA-002). */
export type DeliveryFormat = 'avif' | 'webp' | 'jpeg';

/**
 * Image normalization pipeline (ADR-005 contract, T-UPLOAD-004).
 * Security: input is UNTRUSTED (T-10) — decode validation, metadata strip,
 * dimension guards (≤ 10,000 px pre-decode where headers allow,
 * `limitInputPixels` post-guard) are part of the contract.
 */
export interface ImageProcessorPort {
  /**
   * Decode → strip metadata → resize (max dimension, downscale-only) →
   * encode all three formats. Pure bytes-in / bytes-out.
   * Failure: decode error ⇒ typed UPLOAD_IMAGE_DECODE (page-level).
   */
  normalize(input: Uint8Array, sourceFormat: string): Promise<{
    avif: Uint8Array;
    webp: Uint8Array;
    jpeg: Uint8Array;
    width: number;
    height: number;
  }>;
  /** Cover pipeline (max 1200 px, WebP+JPEG) — FR-UPLOAD-010/T-ADMIN-002. */
  makeCover(input: Uint8Array, sourceFormat: string): Promise<{
    webp: Uint8Array;
    jpeg: Uint8Array;
    width: number;
    height: number;
  }>;
}

/**
 * Telemetry port (ADR-008): the ONLY surface features use for signals.
 * (Traces are ambient via the OTel context; this port covers explicit
 * counters/events where features emit domain signals.)
 * TODO(T-OBS-001/002): implementation in server/telemetry.
 */
export interface TelemetryPort {
  /** Domain event (e.g., job state transition, auth failure reason). */
  event(name: string, attributes: Record<string, string | number | boolean>): void;
  /** Latency observation for a named operation. */
  observe(name: string, durationMs: number, attributes?: Record<string, string>): void;
}

/**
 * Audit sink (FR-ADMIN-007, NFR-SEC-012) — append-only.
 * Implementations MUST expose no update/delete path (T-SEC-005 verifies
 * the DB-level restriction too).
 */
export interface AuditSink {
  append(input: {
    actorId: string | null;
    actorEmail: string | null;
    action: string; // e.g., 'manga.create'
    targetKind: 'manga' | 'chapter' | 'user' | 'upload';
    targetId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ip?: string | null;
  }): Promise<void>;
}
