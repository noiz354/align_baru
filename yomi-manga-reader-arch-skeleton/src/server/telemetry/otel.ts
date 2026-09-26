/**
 * server/telemetry — observability initialization (OTel + pino).
 *
 * Responsibility: traces (W3C context; HTTP/service/DB/STORAGE spans),
 * metrics (OTLP HTTP push, the OBSERVABILITY.md §4 instrument set), the
 * pino root logger (JSON, redaction, requestId/traceId binding), beacon
 * ingestion, and the dashboards/alert-rules files (observability/ dir).
 *
 * Requirements: NFR-OBS-001…007, ADR-008.
 * Tasks: T-OBS-001 (traces), T-OBS-002 (metrics), T-OBS-003 (logs),
 * T-OBS-004 (readyz + error mapping), T-OBS-006 (dashboards/rules),
 * T-OBS-007 (beacon).
 *
 * Package rules (ADR-008 — normative):
 * - app code imports @opentelemetry/api (stable 1.9.x) ONLY; SDK modules
 *   (2.11.x stable) + exporters are imported HERE only (rule D4).
 * - REJECTED: @opentelemetry/sdk-node (experimental — never a dependency).
 * - Exporter failure must never block or crash a request (best-effort).
 * - Span budget: ≤ 8 spans per request on the reader hot path
 *   (OBSERVABILITY.md §2.4 — measured at VS-10).
 * - Labels: bounded cardinality (route = template, never id); no PII
 *   labels (NFR-OBS-006 — lint on label names).
 *
 * TODO(T-OBS-001/002): initTelemetry(env) → { tracer, meter, logger }.
 */
export function initTelemetry(/* env: Env */): unknown {
  throw new Error('Not implemented: T-OBS-001 (telemetry init)');
}
