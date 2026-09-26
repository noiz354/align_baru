// HomeOps - server skeleton (specification phase). Telemetry contract only.

/**
 * Structured logger with a typed allow-list (ADR-015, PRIVACY.md section 5).
 *
 * The type is the control: there is no overload accepting an arbitrary object, so member names,
 * titles, notes, payloads, and SQL text cannot be logged by accident. A unit test asserts that a
 * forbidden field cannot be passed (T-PRIV-002).
 *
 * Allowed fields: code, operation, outcome, durationMs, job, householdIdHash?, requestId, traceId,
 * errorClass, count. Never: name, title, note, body, email, endpoint, payload.
 *
 * Status: unimplemented by design. Owning task: T-OBS-001.
 */
export type LogFields = {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string; // a fixed, code-owned string; never interpolated user content
  readonly code?: string;
  readonly operation?: string;
  readonly outcome?: 'ok' | 'denied' | 'failed';
  readonly durationMs?: number;
  readonly job?: string;
  readonly count?: number;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly errorClass?: string;
};

export function log(_fields: LogFields): void {
  throw new Error('Not implemented: T-OBS-001');
}
