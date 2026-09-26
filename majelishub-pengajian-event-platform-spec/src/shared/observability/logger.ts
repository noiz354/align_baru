/**
 * The only logging interface in the product.
 *
 * Where this belongs: shared/observability (used by every layer).
 * Specification: OBSERVABILITY.md §5/§7, T-OBS-002 (privacy allow-list), T-SEC-004 (token ban).
 *
 * Invariants:
 *   1. Attribute names come from ALLOWED_ATTRIBUTES; unknown names are dropped and counted in
 *      `telemetry_dropped_attribute_total` so a violation is visible, never silent.
 *   2. Token/code/presigned-URL/contact/transcript fields are banned outright (shared ban list).
 *   3. No free text: messages come from a fixed catalogue of event names.
 *   4. `console.*` is banned outside bootstrap (lint rule).
 */
export const ALLOWED_ATTRIBUTES = [
  "requestId", "traceId", "organizationId", "eventId", "registrationId", "attendanceId",
  "sessionId", "jobId", "jobKey", "queue", "attempt", "result", "method", "channel", "kind",
  "policyKey", "durationMs", "sizeBytes", "sequence", "chunkCount", "gapCount", "bytes",
  "outcome", "errorCode", "providerId", "status", "route", "rowsAffected", "dryRun", "deletedCount",
] as const;

export type AllowedAttribute = (typeof ALLOWED_ATTRIBUTES)[number];
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogAttributes = Partial<Record<AllowedAttribute, string | number | boolean>>;

export interface Logger {
  debug(event: string, attributes?: LogAttributes): void;
  info(event: string, attributes?: LogAttributes): void;
  warn(event: string, attributes?: LogAttributes): void;
  error(event: string, attributes?: LogAttributes, error?: unknown): void;
  child(bindings: LogAttributes): Logger;
}

/**
 * Production logger (JSON to stdout).
 * @throws Error("Not implemented: T-OBS-002") until the allow-list, drop counter and ban list exist.
 */
export function createLogger(service: string): Logger {
  throw new Error("Not implemented: T-OBS-002");
}
