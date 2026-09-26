/**
 * Upload pipeline driver (in-process job orchestration).
 *
 * Responsibility: run the state machine (admin-workflow.md §6):
 * queued → validating → processing → ready/failed, with per-phase
 * metrics, the 15-min watchdog, per-chapter advisory lock, and the
 * exactly-once commit handoff (T-UPLOAD-007).
 *
 * Requirements: FR-UPLOAD-007/011, NFR-SEC-008 (watchdog), NFR-OBS-007.
 * Tasks: T-UPLOAD-006 (driver), T-UPLOAD-001 (intake), T-OBS-005 (sweep).
 *
 * Phases (delegations — the driver orchestrates, it doesn't implement):
 * 1. validating: prepareChapterUpload (pure, T-UPLOAD-014)
 * 2. processing: safe extraction (T-UPLOAD-003) → per page, ≤ 4
 *    concurrent: ImageProcessorPort.normalize (T-UPLOAD-004) →
 *    ObjectStoragePort.putStream × 3 variants (T-UPLOAD-005)
 * 3. commit: ChapterRepository.commitPages (ONE transaction, T-UPLOAD-007)
 *
 * Invariants (normative):
 * - forward-only state transitions; `failed` is terminal (no auto-retry —
 *   documented: the curator decides)
 * - commit atomicity: no "ready chapter with missing pages" state
 *   (crash ⇒ rollback + job failed + staging purge)
 * - one active job per chapter (advisory lock; second submit ⇒ 409)
 * - failures carry a typed code + human message (no paths — T-13)
 * - staging always purges (24 h lifecycle; immediate on failure)
 *
 * Edge cases:
 * - app restart mid-processing (job left processing; boot sweep marks
 *   ops.timeout after 15 min — RUNBOOK 3.1, T-OBS-005)
 * - storage 502 mid-job (job failed; partial objects purged; no orphans)
 * - manga deleted mid-job (commit fails MANGA_DELETED, typed)
 * - 200-page job wall-clock budget ≤ 3 min reference (PERFORMANCE §9)
 */
import type { UploadJobId } from '../../shared/types';

export interface UploadPipeline {
  /** Process a queued job (inline for small, background for large). */
  run(jobId: UploadJobId): Promise<void>;

  /** Boot sweep: mark stale `processing` jobs failed (ops.timeout). */
  sweepStale(): Promise<number>;
}

/**
 * TODO(T-UPLOAD-006): factory (wired with ObjectStoragePort,
 * ImageProcessorPort, ChapterRepository, UploadJobRepository, AuditSink,
 * TelemetryPort).
 */
export function createUploadPipeline(deps: {
  storage: import('../../shared/contracts').ObjectStoragePort;
  media: import('../../shared/contracts').ImageProcessorPort;
  chapters: import('../chapters').ChapterRepository;
  jobs: import('./upload.repository').UploadJobRepository;
  audit: import('../../shared/contracts').AuditSink;
  telemetry: import('../../shared/contracts').TelemetryPort;
}): UploadPipeline {
  throw new Error('Not implemented: T-UPLOAD-006 (pipeline driver wiring)');
}
