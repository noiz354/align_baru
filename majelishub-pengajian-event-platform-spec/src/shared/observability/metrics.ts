/**
 * Metrics catalogue - the authoritative names and their low-cardinality labels, as typed constants.
 *
 * Where this belongs: shared/observability.
 * Specification: OBSERVABILITY.md §4 (authoritative names), ADR-0019 (OTel API-only, OTLP export),
 *   TASKS.md T-OBS-002 ("the metric catalogue is implemented as typed constants").
 *
 * What this module is: the vocabulary. A metric name that is not in `METRIC_CATALOGUE` does not exist,
 * and a label that is not declared for it is rejected - so the "never ids of people or events as label
 * values" rule is enforced by types and by a runtime check, not by review.
 *
 * What this module is NOT: an exporter. There is no collector in the delivered stack, so counters live in
 * this process and are read back with `metricsSnapshot()` (and reported on the `telemetry.metrics`
 * line). Wiring them to OTLP over `@opentelemetry/api` is the tracing half of T-OBS-002 and is still
 * open; a fake exporter would be worse than a documented absence (AGENTS.md §4.1).
 *
 * Failure cases: unknown metric name -> throws (a programming error, and TypeScript already rejects it) ·
 * unknown label key -> throws · a label value that is not a string/number/boolean -> throws. Telemetry
 * must never break the product, so callers on a hot path use the logger, which never throws.
 */

/** Metric name -> the label keys it may carry. Names are verbatim from OBSERVABILITY.md §4. */
export const METRIC_CATALOGUE = {
  // Registration
  registration_total: ["result"],
  registration_duration_ms: ["result"],
  capacity_contention_total: ["result"],
  // Check-in
  checkin_total: ["result"],
  checkin_duration_ms: ["result", "method"],
  checkin_manual_total: ["method"],
  checkin_duplicate_scan_total: [],
  checkin_device_switch_total: [],
  // Attendance
  attendance_records_total: ["method"],
  attendance_corrections_total: ["action"],
  attendance_stats_drift_total: [],
  // Recording & media
  recording_sessions_total: ["result"],
  recording_duration_ms: ["result"],
  recording_chunk_gap_ms_total: [],
  recording_gap_sessions_total: [],
  upload_chunk_total: ["result"],
  upload_backlog_chunks: [],
  upload_chunk_duration_ms: ["result"],
  audio_assembly_duration_ms: [],
  audio_process_duration_ms: ["operation"],
  audio_processing_failures_total: ["stage"],
  // Transcription
  transcription_jobs_total: ["provider", "result"],
  transcription_duration_s: ["provider"],
  transcription_queue_age_s: [],
  transcript_review_age_s: [],
  transcript_approvals_total: ["role"],
  transcript_publications_total: [],
  // Notifications
  notification_intents_total: ["templateKey", "class"],
  notification_failures_total: ["channel", "errorCode"],
  notification_dispatch_duration_ms: ["channel"],
  notification_dead_letter_total: ["channel"],
  // Platform
  http_request_duration_ms: ["route", "method", "status"],
  job_duration_ms: ["queue", "outcome"],
  job_failures_total: ["queue", "errorCode"],
  db_query_duration_ms: ["operation"],
  db_pool_saturation: [],
  storage_operation_duration_ms: ["op"],
  retention_deleted_total: ["policyKey"],
  retention_failures_total: ["policyKey"],
  retention_run_age_s: [],
  /** The guardrail counter: must be 0 in normal operation (OBSERVABILITY.md §7). */
  telemetry_dropped_attribute_total: ["kind"],
  rate_limit_rejections_total: ["route"],
  slo_burn_rate: ["slo"],
} as const satisfies Record<string, readonly string[]>;

export type MetricName = keyof typeof METRIC_CATALOGUE;
export type MetricLabels<N extends MetricName> = Partial<Record<(typeof METRIC_CATALOGUE)[N][number], string | number | boolean>>;

export interface MetricSample {
  readonly name: MetricName;
  readonly value: number;
  readonly labels: Readonly<Record<string, string | number | boolean>>;
}

export interface MetricSink {
  (sample: MetricSample): void;
}

const counters = new Map<string, number>();
let sink: MetricSink | undefined;

/** Serialises a label set into the counter's storage key. */
function keyFor(name: MetricName, labels: Readonly<Record<string, string | number | boolean>>): string {
  const parts = Object.keys(labels)
    .sort()
    .map((key) => `${key}=${String(labels[key])}`);
  return parts.length === 0 ? name : `${name}{${parts.join(",")}}`;
}

function assertLabels(name: MetricName, labels: Readonly<Record<string, unknown>>): void {
  const declared: readonly string[] = METRIC_CATALOGUE[name];
  for (const [key, value] of Object.entries(labels)) {
    if (!declared.includes(key)) {
      throw new Error(`Metric ${name} has no label "${key}" (declared: ${declared.join(", ") || "none"})`);
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new Error(`Metric ${name} label "${key}" must be a string, number or boolean`);
    }
  }
}

/** Registers the exporter. Returns the previous sink so a caller (or a test) can restore it. */
export function setMetricSink(next: MetricSink | undefined): MetricSink | undefined {
  const previous = sink;
  sink = next;
  return previous;
}

/**
 * Records one metric sample: increments a counter for `*_total` names, otherwise records the value.
 *
 * @throws Error on an unknown metric name or an undeclared label - both are programming errors that
 *   TypeScript already rejects, and failing loudly is what keeps the catalogue honest
 */
export function recordMetric<N extends MetricName>(
  name: N,
  labels: MetricLabels<N> = {},
  value = 1,
): void {
  if (!(name in METRIC_CATALOGUE)) throw new Error(`Unknown metric "${name}" (OBSERVABILITY.md §4)`);
  const flat = labels as Readonly<Record<string, string | number | boolean>>;
  assertLabels(name, flat);

  const key = keyFor(name, flat);
  counters.set(key, name.endsWith("_total") ? (counters.get(key) ?? 0) + value : value);
  sink?.({ name, value, labels: flat });
}

/** Increments `telemetry_dropped_attribute_total`; `kind` distinguishes why the attribute was dropped. */
export function recordDroppedAttribute(kind: "banned" | "unknown" | "invalidValue" | "invalidEvent"): void {
  recordMetric("telemetry_dropped_attribute_total", { kind });
}

/** Current counter values, keyed as `name{label=value,…}`. Read by tests and by the boot report. */
export function metricsSnapshot(): ReadonlyMap<string, number> {
  return new Map(counters);
}

/** Clears every counter. Tests only - production never resets a counter. */
export function resetMetrics(): void {
  counters.clear();
}
