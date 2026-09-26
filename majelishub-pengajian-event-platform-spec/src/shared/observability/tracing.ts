/**
 * Tracing helpers.
 *
 * Where this belongs: shared/observability; specification OBSERVABILITY.md §6.
 * Invariants:
 *   1. The OTel instrumentation must be loaded BEFORE application code (`--import`) or no spans exist -
 *      this is a deployment requirement, not a detail (docs/research/STACK-2026.md §15).
 *   2. Span attributes follow the same allow-list as logs; a span never carries content.
 *   3. Trace context propagates into job payloads so a background job can be traced to its request.
 *   4. Sampling: 10% default; 100% for checkin.* and recording chunk uploads during event hours.
 */
export interface SpanAttributes {
  readonly organizationId?: string;
  readonly eventId?: string;
  readonly result?: string;
  readonly method?: string;
  readonly sizeBytes?: number;
  readonly sequence?: number;
}

/**
 * Wrap an operation in a span named `<domain>.<operation>`.
 * @throws Error("Not implemented: T-OBS-002")
 */
export async function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: () => Promise<T>,
): Promise<T> {
  throw new Error("Not implemented: T-OBS-002");
}
