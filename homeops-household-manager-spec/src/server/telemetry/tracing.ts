// HomeOps — operation spans (T-OBS-003 shape, ADR-015, OBSERVABILITY.md §3).
//
// The application must run fully without an exporter: when OTEL_EXPORTER_OTLP_ENDPOINT is absent,
// tracing records durations in-process and emits nothing (ADR-015). Spans never carry member names,
// titles, notes, or SQL text — ids and durations only. The OTLP SDK bootstrap lands in T-OBS-002
// behind exactly these two functions, so no caller changes.

import { recordMetric } from './metrics';
import { logger } from './logger';

export type SpanRecord = {
  readonly operation: string;
  readonly durationMs: number;
  readonly outcome: 'ok' | 'failed';
  readonly startedAt: number;
};

const spans: SpanRecord[] = [];
const MAX_SPANS = 512;

/**
 * Bootstrap tracing. Returns true when an exporter is configured; false means the no-op path, which
 * is a supported production configuration, not a degraded one (ADR-015).
 */
export function startTracing(): boolean {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) {
    logger.debug('tracing disabled: no OTLP endpoint configured');
    return false;
  }
  // T-OBS-002 wires @opentelemetry/sdk-node here. Until then an endpoint is acknowledged and the
  // in-process recorder below is the exporter's source, so nothing is silently dropped.
  logger.info('tracing endpoint configured', { operation: 'tracing.bootstrap', outcome: 'ok' });
  return true;
}

/** Run `fn` inside a named span: `op.<module>.<action>` (OBSERVABILITY.md §3). */
export async function withOperationSpan<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    record(operation, startedAt, 'ok');
    return result;
  } catch (error) {
    record(operation, startedAt, 'failed');
    throw error;
  }
}

function record(operation: string, startedAt: number, outcome: 'ok' | 'failed'): void {
  const durationMs = Date.now() - startedAt;
  spans.push({ operation, durationMs, outcome, startedAt });
  if (spans.length > MAX_SPANS) spans.splice(0, spans.length - MAX_SPANS);
  const [module, action] = operation.split('.');
  recordMetric('op_duration_ms', durationMs, {
    module: module ?? 'unknown',
    operation: action ?? operation,
    outcome,
  });
}

/** Test/diagnostic accessor: the most recent spans, oldest first. */
export function recentSpans(limit = 50): readonly SpanRecord[] {
  return spans.slice(Math.max(0, spans.length - limit));
}

export function resetSpans(): void {
  spans.length = 0;
}
