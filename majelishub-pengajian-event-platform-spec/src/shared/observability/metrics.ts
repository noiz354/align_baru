/**
 * Metric catalogue as typed constants - the names are the contract with the dashboards and alerts.
 *
 * Where this belongs: shared/observability; specification OBSERVABILITY.md §4 (authoritative names).
 * Invariants:
 *   1. Label values are low-cardinality enums (result, method, channel, kind, policyKey). Never an
 *      organization id, event id or participant id.
 *   2. A metric exists because an alert or a documented decision consumes it - no vanity counters.
 *   3. Histograms are used for durations; gauges for backlogs/ages.
 */
export const METRICS = {
  checkinTotal: "checkin_total",
  checkinDurationMs: "checkin_duration_ms",
  checkinManualTotal: "checkin_manual_total",
  checkinDuplicateScanTotal: "checkin_duplicate_scan_total",
  registrationTotal: "registration_total",
  registrationDurationMs: "registration_duration_ms",
  attendanceRecordsTotal: "attendance_records_total",
  attendanceCorrectionsTotal: "attendance_corrections_total",
  attendanceStatsDriftTotal: "attendance_stats_drift_total",
  uploadChunkTotal: "upload_chunk_total",
  uploadBacklogChunks: "upload_backlog_chunks",
  audioAssemblyDurationMs: "audio_assembly_duration_ms",
  audioProcessDurationMs: "audio_process_duration_ms",
  recordingSessionsTotal: "recording_sessions_total",
  recordingGapSessionsTotal: "recording_gap_sessions_total",
  transcriptionJobsTotal: "transcription_jobs_total",
  transcriptionQueueAgeS: "transcription_queue_age_s",
  transcriptReviewAgeS: "transcript_review_age_s",
  notificationIntentsTotal: "notification_intents_total",
  notificationFailuresTotal: "notification_failures_total",
  jobFailuresTotal: "job_failures_total",
  retentionDeletedTotal: "retention_deleted_total",
  retentionRunAgeS: "retention_run_age_s",
  telemetryDroppedAttributeTotal: "telemetry_dropped_attribute_total",
  httpRequestDurationMs: "http_request_duration_ms",
} as const;

/**
 * Meter factory. Wires OTel metrics after the SDK is initialised (T-OBS-002).
 * @throws Error("Not implemented: T-OBS-002")
 */
export function createMeters(): unknown {
  throw new Error("Not implemented: T-OBS-002");
}
