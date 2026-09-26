// HomeOps - server skeleton (specification phase). Telemetry contract only.

/**
 * Metric catalogue (OBSERVABILITY.md section 4). Labels are enum-like only: never a household id,
 * member id, entity id, or free text - for privacy and cardinality both (ADR-015).
 *
 * Status: unimplemented by design. Owning task: T-OBS-004.
 */
export const METRIC_NAMES = [
  'http_server_duration_ms', 'op_duration_ms', 'db_query_duration_ms',
  'scheduler_job_duration_ms', 'scheduler_tick_age_seconds', 'scheduler_job_failures_total',
  'alerts_created_total', 'alerts_open_total', 'alert_transitions_total',
  'notification_intents_total', 'notification_suppressed_total', 'notification_attempts_total',
  'outbox_pending', 'outbox_dead_letters', 'prune_rows_deleted_total',
  'auth_failures_total', 'attachments_bytes', 'db_size_bytes',
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

export function recordMetric(_name: MetricName, _value: number, _labels?: Readonly<Record<string, string>>): void {
  throw new Error('Not implemented: T-OBS-004');
}
