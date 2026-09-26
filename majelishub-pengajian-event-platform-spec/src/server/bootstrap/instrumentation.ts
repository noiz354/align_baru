/**
 * OpenTelemetry bootstrap - must be imported BEFORE application code (`node --import`), or no spans
 * will exist for the first requests (docs/research/STACK-2026.md §15).
 *
 * Where this belongs: server/bootstrap.
 * Specification: OBSERVABILITY.md §3/§6, TASKS.md T-OBS-002.
 * Invariants: traces and metrics only (OTel JS logs are still maturing); JSON logs go to stdout;
 *   sampling is configurable and raised for check-in paths during event hours; an unreachable exporter
 *   must never break the product.
 * Task ownership: T-OBS-002.
 */
export interface InstrumentationState {
  readonly enabled: boolean;
  readonly serviceName: string;
  readonly samplingRatio: number;
}

/** @throws Error("Not implemented: T-OBS-002") */
export function startInstrumentation(): InstrumentationState {
  throw new Error("Not implemented: T-OBS-002");
}
