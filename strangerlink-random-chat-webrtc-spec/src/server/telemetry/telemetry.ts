/**
 * Telemetry port and the no-content policy.
 *
 * Requirements:
 * - NFR-OBS-001 (metrics and alerts)
 * - NFR-OBS-002 (dashboards must never display private chat contents)
 * - NFR-OBS-003 (structured logs without sensitive data)
 *
 * ADR:
 * - ADR-015 (observability)
 *
 * See:
 * - OBSERVABILITY.md
 * - SECURITY.md §14
 * - THREAT_MODEL.md T-21, T-32
 *
 * PORT ONLY. No exporter is configured and no span is created in this phase.
 *
 * THE NO-CONTENT POLICY (ADR-015):
 * A shared tracing helper is the ONLY permitted way to create spans. It
 * accepts an allowlist of attribute keys. No content, no addresses, no peer
 * linkage within a span.
 */

/**
 * The span attribute allowlist.
 *
 * Identifiers and durations are permitted. CONTENT AND ADDRESSES ARE NOT.
 *
 * A test asserts that this allowlist contains no content key and no address
 * key (docs/security/CONTROLS.md PC-6).
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

/**
 * Attribute keys that are FORBIDDEN, stated explicitly so that a reviewer
 * can check the allowlist against them.
 */
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

/**
 * Assert that an attribute key is permitted.
 *
 * T-OBS-111
 *
 * Throws until implemented. When implemented, this must be the single gate
 * through which every span attribute passes.
 */
export function assertAllowedSpanAttribute(key: string): void {
  throw new Error(`Not implemented: T-OBS-111 (attribute: ${key})`);
}

/**
 * The log field allowlist.
 *
 * The logging helper rejects any key outside this list (T-21).
 */
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

/**
 * Telemetry port.
 *
 * T-OBS-111
 *
 * Throws until implemented. When implemented it must:
 * - create spans only through the allowlisted helper
 * - never use identifiers as metric labels (cardinality)
 * - sample safety spans at an elevated rate
 * - never block the application on export failure
 */
export interface TelemetryPort {
  startSpan(name: string, attributes: Record<string, unknown>): SpanHandle;
  incrementCounter(name: string, value?: number): void;
  observeHistogram(name: string, value: number): void;
  setGauge(name: string, value: number): void;
  log(fields: Record<string, unknown>): void;
}

export interface SpanHandle {
  end(): void;
  setAttribute(key: string, value: unknown): void;
}

export const createNotImplementedTelemetryPort = (): TelemetryPort => ({
  startSpan(_name: string, _attributes: Record<string, unknown>): SpanHandle {
    throw new Error('Not implemented: T-OBS-111');
  },
  incrementCounter(_name: string, _value?: number): void {
    throw new Error('Not implemented: T-OBS-111');
  },
  observeHistogram(_name: string, _value: number): void {
    throw new Error('Not implemented: T-OBS-111');
  },
  setGauge(_name: string, _value: number): void {
    throw new Error('Not implemented: T-OBS-111');
  },
  log(_fields: Record<string, unknown>): void {
    throw new Error('Not implemented: T-OBS-111');
  },
});

/**
 * Paging safety alerts. See OBSERVABILITY.md §4 and RUNBOOK.md.
 *
 * These page. Everything else tickets.
 */
export const PAGING_ALERTS = [
  'safety.p0.unacknowledged',
  'safety.report_rate_spike',
  'retention.job.failure',
  'session.per_participant_exceeded',
  'signaling.protocol_violation_spike',
  'ban.store.unreachable',
] as const;
