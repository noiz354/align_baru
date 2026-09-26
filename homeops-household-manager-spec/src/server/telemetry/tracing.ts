// HomeOps - server skeleton (specification phase). Tracing contract only.

/**
 * OpenTelemetry bootstrap (ADR-015). The application must run fully without an exporter: when
 * OTEL_EXPORTER_OTLP_ENDPOINT is absent, the SDK is a no-op and nothing breaks. Spans never carry
 * member names, titles, notes, or SQL text - ids and durations only (OBSERVABILITY.md section 3).
 *
 * Status: unimplemented by design. Owning tasks: T-OBS-002, T-OBS-003.
 */
export function startTracing(): void {
  throw new Error('Not implemented: T-OBS-002');
}

export function withOperationSpan<T>(_operation: string, _fn: () => Promise<T>): Promise<T> {
  throw new Error('Not implemented: T-OBS-003');
}
