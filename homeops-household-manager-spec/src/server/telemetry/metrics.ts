// HomeOps — metric catalogue (T-OBS-004 shape, OBSERVABILITY.md §4, ADR-015).
//
// Labels are enum-like only: never a household id, member id, entity id, or free text — for privacy
// and cardinality both. The registry below is in-process; the OTLP exporter is wired in T-OBS-002
// and the application must behave identically without it (ADR-015: no exporter = no-op).

export const METRIC_NAMES = [
  'http_server_duration_ms',
  'op_duration_ms',
  'db_query_duration_ms',
  'scheduler_job_duration_ms',
  'scheduler_tick_age_seconds',
  'scheduler_job_failures_total',
  'alerts_created_total',
  'alerts_open_total',
  'alert_transitions_total',
  'notification_intents_total',
  'notification_suppressed_total',
  'notification_attempts_total',
  'outbox_pending',
  'outbox_dead_letters',
  'prune_rows_deleted_total',
  'auth_failures_total',
  'attachments_bytes',
  'db_size_bytes',
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

/** Allowed label keys per metric. A label outside this list is refused at runtime (bounded cardinality). */
const ALLOWED_LABELS: Readonly<Record<MetricName, readonly string[]>> = {
  http_server_duration_ms: ['route_kind', 'status_class', 'outcome'],
  op_duration_ms: ['module', 'operation', 'outcome'],
  db_query_duration_ms: ['operation', 'table', 'outcome'],
  scheduler_job_duration_ms: ['job', 'outcome'],
  scheduler_tick_age_seconds: ['job'],
  scheduler_job_failures_total: ['job'],
  alerts_created_total: ['alert_type', 'priority'],
  alerts_open_total: ['alert_type', 'priority'],
  alert_transitions_total: ['alert_type', 'to_state', 'reason'],
  notification_intents_total: ['channel', 'alert_type'],
  notification_suppressed_total: ['channel', 'reason'],
  notification_attempts_total: ['channel', 'outcome'],
  outbox_pending: [],
  outbox_dead_letters: [],
  prune_rows_deleted_total: ['table'],
  auth_failures_total: ['reason'],
  attachments_bytes: ['kind'],
  db_size_bytes: [],
};

type Sample = {
  readonly value: number;
  readonly labels: Readonly<Record<string, string>>;
  readonly at: number;
};

const registry = new Map<string, Sample[]>();
const MAX_SERIES_PER_METRIC = 256;

function seriesKey(name: MetricName, labels: Readonly<Record<string, string>>): string {
  const parts = Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`);
  return `${name}{${parts.join(',')}}`;
}

/**
 * Record one observation. Refuses labels that are not in the catalogue: a label set that grows per
 * household or per entity would be both a privacy leak and a cardinality bomb (ADR-015).
 */
export function recordMetric(
  name: MetricName,
  value: number,
  labels: Readonly<Record<string, string>> = {},
): void {
  if (!METRIC_NAMES.includes(name)) {
    // The catalogue is closed: an uncatalogued metric is a bug, not a new series (ADR-015).
    throw new TypeError(`recordMetric: "${name}" is not in METRIC_NAMES`);
  }
  const allowed = ALLOWED_LABELS[name] ?? [];
  for (const key of Object.keys(labels)) {
    if (!allowed.includes(key)) {
      throw new TypeError(
        `recordMetric(${name}): label "${key}" is not in the catalogue (allowed: ${allowed.join(', ') || 'none'})`,
      );
    }
  }
  if (!Number.isFinite(value)) throw new TypeError(`recordMetric(${name}): value must be finite`);
  const key = seriesKey(name, labels);
  const existing = registry.get(key) ?? [];
  existing.push({ value, labels, at: Date.now() });
  // Bounded memory: keep the newest samples only. The exporter (T-OBS-002) flushes on an interval.
  if (existing.length > 64) existing.splice(0, existing.length - 64);
  if (registry.size > MAX_SERIES_PER_METRIC * METRIC_NAMES.length) registry.delete(key);
  registry.set(key, existing);
}

/** Snapshot for tests, `/api/health?deep=1`, and the future OTLP flush. */
export function snapshotMetrics(): Record<
  string,
  { readonly count: number; readonly last: number; readonly sum: number }
> {
  const out: Record<string, { count: number; last: number; sum: number }> = {};
  for (const [key, samples] of registry) {
    if (samples.length === 0) continue;
    const last = samples[samples.length - 1];
    out[key] = {
      count: samples.length,
      last: last?.value ?? 0,
      sum: samples.reduce((total, sample) => total + sample.value, 0),
    };
  }
  return out;
}

/** Test helper: drop every recorded series (TESTING.md TP-6, no cross-test state). */
export function resetMetrics(): void {
  registry.clear();
}

export function allowedLabelsFor(name: MetricName): readonly string[] {
  return ALLOWED_LABELS[name] ?? [];
}
