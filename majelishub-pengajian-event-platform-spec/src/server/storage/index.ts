/**
 * Object storage adapter (S3-compatible: MinIO, R2, B2, Wasabi).
 *
 * Where this belongs: server/storage; everything above uses this port, never a provider SDK.
 * Specification: docs/media/STORAGE.md, ADR-0013, docs/research/STACK-2026.md §11.
 * Invariants:
 *   1. Buckets are private; all access is app-mediated or via short-lived signed URLs.
 *   2. No dependency on provider tagging, versioning, object lock or lifecycle rules (R2 returns 501
 *      for tagging): housekeeping is our jobs.
 *   3. Object keys derive from ids (`audio/{org}/{event}/{session}/{sequence}.part`) - never a
 *      user-supplied filename.
 *   4. Success means the object exists with the expected size; zero-byte writes are impossible by
 *      construction and treated as corruption if found.
 *   5. Every write records a SHA-256 for later verification.
 * Task ownership: T-AUDIO-004/009/014, T-OPS-006.
 */
import type { GapManifestEntry } from "@/shared/contracts/audio";

export interface StoragePutResult {
  readonly key: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly etag?: string;
}

export interface StoragePort {
  put(input: { bucket: "PARTIAL" | "MASTER" | "DERIVED" | "EXPORTS"; key: string; bytes: Uint8Array; contentType: string }): Promise<StoragePutResult>;
  get(bucket: "PARTIAL" | "MASTER" | "DERIVED" | "EXPORTS", key: string): Promise<Uint8Array>;
  head(bucket: "PARTIAL" | "MASTER" | "DERIVED" | "EXPORTS", key: string): Promise<{ bytes: number } | null>;
  delete(bucket: "PARTIAL" | "MASTER" | "DERIVED" | "EXPORTS", key: string): Promise<void>;
  /** Non-fatal capability probe (tagging/versioning/SSE) logged once at boot. */
  probeCapabilities(): Promise<{ tagging: boolean; versioning: boolean; serverSideEncryption: boolean; pathStyle: boolean }>;
}

/** @throws Error("Not implemented: T-AUDIO-004") */
export function storage(): StoragePort {
  throw new Error("Not implemented: T-AUDIO-004");
}

/** Gap manifest helper used by the assembler and the disclosure text. */
export function describeGaps(gaps: readonly GapManifestEntry[]): string {
  throw new Error("Not implemented: T-AUDIO-009");
}
