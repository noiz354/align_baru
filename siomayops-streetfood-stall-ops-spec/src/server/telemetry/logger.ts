/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/** Structured JSON logs (Pino) with correlation IDs and NO personal data content (NFR-OBS-001).
 *  The OTel JS Logs API is still maturing, so logs stay JSON → OTLP (docs/research/STACK-2026.md). */
export interface LogContext {
  readonly organizationId?: string;
  readonly actorId?: string;
  readonly correlationId?: string;
  readonly route?: string;
  readonly jobName?: string;
}

export interface Logger {
  info(message: string, context?: LogContext & Record<string, unknown>): void;
  warn(message: string, context?: LogContext & Record<string, unknown>): void;
  error(message: string, error: unknown, context?: LogContext & Record<string, unknown>): void;
}

/** Throws. Task: T-OBS-001. */
export function createLogger(): Logger {
  throw new Error("Not implemented: T-OBS-001");
}
