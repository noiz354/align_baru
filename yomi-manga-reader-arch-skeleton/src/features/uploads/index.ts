/**
 * features/uploads — public surface (rule D9).
 *
 * Depends on: chapters, manga (ports) + infrastructure ports (ObjectStorage,
 * ImageProcessor, AuditSink, TelemetryPort) — per dependency-rules.md §2.
 * Used by: web (admin uploads APIs), admin service (re-ingest entry point).
 *
 * The pure core (prepareChapterUpload) is the security-critical unit —
 * unit-tested without any infrastructure (T-UPLOAD-014/015).
 */
export * from './prepare-chapter-upload';
export * from './upload-pipeline';
export * from './upload.repository';
