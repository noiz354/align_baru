/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/** OpenTelemetry traces for HTTP requests, sync batches, job executions and provider callbacks
 *  (NFR-OBS-002). Phase 0: no SDK is started anywhere. */
export interface SpanAttributes {
  readonly [key: string]: string | number | boolean;
}

/** Throws. Task: T-OBS-001. */
export async function withSpan<T>(
  _name: string,
  _attributes: SpanAttributes,
  _fn: () => Promise<T>
): Promise<T> {
  throw new Error("Not implemented: T-OBS-001");
}
