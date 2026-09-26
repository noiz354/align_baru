/**
 * UploadJobRepository port (features/uploads owns the state machine rules;
 * server/db implements against DATA_MODEL §16).
 *
 * Requirements: FR-UPLOAD-007, NFR-DATA-001.
 * Tasks: T-UPLOAD-007 (implementation), T-ADMIN-008 (stats consumer).
 *
 * Invariants:
 * - state transitions are forward-only (queued → validating → processing →
 *   ready|failed); `failed` is terminal — enforced by CHECK constraint
 *   (DB) + service guard (domain).
 * - error code/message are set exactly once (at failure).
 * - reads for the admin UI: by id, recent list (state filter), 24 h /
 *   30 d health aggregates for stats (FR-ADMIN-008).
 */
import type { UploadJob, UploadState } from '../../shared/contracts';
import type { UploadJobId } from '../../shared/types';

export interface UploadJobRepository {
  create(input: {
    mangaId: string | null;
    chapterId: string | null;
    createdBy: string | null;
    inputKind: 'zip' | 'images';
    fileCount: number | null;
    byteSize: number | null;
    idempotencyKey: string; // 24 h dedupe (API_CONTRACT §2.7)
  }): Promise<UploadJob>;

  /** Idempotency lookup (same key within 24 h ⇒ original job). */
  findByIdempotencyKey(chapterId: string, key: string): Promise<UploadJob | null>;

  /** Forward-only transition (rejects backward/terminal skips). */
  transition(jobId: UploadJobId, to: UploadState, failure?: { code: string; message: string } | null): Promise<void>;

  byId(jobId: UploadJobId): Promise<UploadJob | null>;
  recent(query: { cursor?: string; limit?: number; state?: UploadState }): Promise<{
    items: UploadJob[];
    nextCursor: string | null;
  }>;

  /** Health aggregates for the stats dashboard (FR-ADMIN-008). */
  health(windowDays: number): Promise<{
    ready: number;
    failed: number;
    p50DurationMs: number | null;
    p95DurationMs: number | null;
    topFailureCodes: Array<{ code: string; count: number }>;
  }>;

  /** Stale `processing` jobs (oldest first) — for the boot sweep. */
  staleProcessing(olderThanMs: number): Promise<Array<{ id: UploadJobId; startedAt: string | null }>>;
}
