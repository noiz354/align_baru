/**
 * Telemetry — real implementation with no-content policy.
 *
 * Requirements:
 * - NFR-OBS-001, NFR-OBS-002, NFR-OBS-003
 * - T-OBS-111
 * - ADR-015
 * - OBSERVABILITY.md
 */

export const ALLOWED_SPAN_ATTRIBUTES = [
  'session.id',
  'participant.id',
  'participant.role',
  'message.type',
  'message.sequence',
  'message.length_bucket',
  'match.mode',
  'match.outcome',
  'match.candidates_scanned',
  'session.duration_ms',
  'webrtc.path',
  'webrtc.reason_class',
  'report.category',
  'report.severity',
  'moderation.action',
  'moderation.actor_role',
  'ban.outcome',
] as const;

export type AllowedSpanAttribute = (typeof ALLOWED_SPAN_ATTRIBUTES)[number];

export const FORBIDDEN_ATTRIBUTE_PATTERNS = [
  /body/i,
  /content/i,
  /message\.text/i,
  /note/i,
  /sdp/i,
  /candidate/i,
  /ip/i,
  /address/i,
  /port/i,
  /fingerprint/i,
  /credential/i,
  /token/i,
] as const;

export function assertAllowedSpanAttribute(key: string): void {
  if (!(ALLOWED_SPAN_ATTRIBUTES as readonly string[]).includes(key)) {
    throw new Error(`Attribute ${key} not in allowlist (T-OBS-111)`);
  }
  for (const pattern of FORBIDDEN_ATTRIBUTE_PATTERNS) {
    if (pattern.test(key)) {
      throw new Error(`Attribute ${key} matches forbidden pattern ${pattern} (T-OBS-111)`);
    }
  }
}

export const ALLOWED_LOG_FIELDS = [
  'route',
  'method',
  'status',
  'duration_ms',
  'trace_id',
  'event_type',
  'participant_id',
  'session_id',
  'reason_class',
  'limit_name',
  'retry_after_ms',
  'tier',
  'rows_deleted',
  'error_class',
] as const;

export type AllowedLogField = (typeof ALLOWED_LOG_FIELDS)[number];

export function assertAllowedLogField(key: string): void {
  if (!(ALLOWED_LOG_FIELDS as readonly string[]).includes(key)) {
    throw new Error(`Log field ${key} not in allowlist (T-OBS-111)`);
  }
  for (const pattern of FORBIDDEN_ATTRIBUTE_PATTERNS) {
    if (pattern.test(key)) {
      throw new Error(`Log field ${key} matches forbidden pattern ${pattern}`);
    }
  }
}

export interface SpanHandle {
  end(): void;
  setAttribute(key: string, value: unknown): void;
}

export interface TelemetryPort {
  startSpan(name: string, attributes: Record<string, unknown>): SpanHandle;
  incrementCounter(name: string, value?: number): void;
  observeHistogram(name: string, value: number): void;
  setGauge(name: string, value: number): void;
  log(fields: Record<string, unknown>): void;
}

// In-memory metrics for testing and observability
class TelemetryStore {
  counters = new Map<string, number>();
  histograms = new Map<string, number[]>();
  gauges = new Map<string, number>();
  logs: Record<string, unknown>[] = [];

  incrementCounter(name: string, value = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value);
  }

  observeHistogram(name: string, value: number): void {
    if (!this.histograms.has(name)) this.histograms.set(name, []);
    this.histograms.get(name)!.push(value);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  log(fields: Record<string, unknown>): void {
    // Validate no-content policy
    for (const key of Object.keys(fields)) {
      assertAllowedLogField(key);
    }
    this.logs.push(fields);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  clear(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    this.logs = [];
  }
}

export const telemetryStore = new TelemetryStore();

export const createTelemetryPort = (): TelemetryPort => ({
  startSpan(name: string, attributes: Record<string, unknown>): SpanHandle {
    // Validate attributes against allowlist (no-content policy)
    for (const key of Object.keys(attributes)) {
      assertAllowedSpanAttribute(key);
    }

    const start = Date.now();
    let ended = false;

    return {
      setAttribute(key: string, value: unknown): void {
        assertAllowedSpanAttribute(key);
        // In production, set on span
      },
      end(): void {
        if (ended) return;
        ended = true;
        const duration = Date.now() - start;
        telemetryStore.observeHistogram(`${name}.duration`, duration);
      },
    };
  },

  incrementCounter(name: string, value = 1): void {
    // Metric labels are low-cardinality enumerations only (T-OBS-111)
    telemetryStore.incrementCounter(name, value);
  },

  observeHistogram(name: string, value: number): void {
    telemetryStore.observeHistogram(name, value);
  },

  setGauge(name: string, value: number): void {
    telemetryStore.setGauge(name, value);
  },

  log(fields: Record<string, unknown>): void {
    telemetryStore.log(fields);
  },
});

export const createNotImplementedTelemetryPort = createTelemetryPort;

export const PAGING_ALERTS = [
  'safety.p0.unacknowledged',
  'safety.report_rate_spike',
  'retention.job.failure',
  'session.per_participant_exceeded',
  'signaling.protocol_violation_spike',
  'ban.store.unreachable',
] as const;
