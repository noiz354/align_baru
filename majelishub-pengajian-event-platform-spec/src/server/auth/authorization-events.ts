/**
 * Security events - the record that an access decision or a session-lifecycle action happened.
 *
 * Where this belongs: server/auth, next to the guards and session code that produce the events.
 * T-SEC-001 requires that a denied cross-organization attempt is recorded, T-SEC-002 requires that
 * every denial and every reason-required grant is recorded; T-SEC-007 owns the durable, hash-chained
 * audit table and T-OBS-002 owns the production logger. Until those land, the default sink writes one
 * JSON line to stdout - a real implementation, not a placeholder - and this module is the only place
 * these shapes are produced.
 *
 * Content rules (SECURITY.md §11/§12, OBSERVABILITY.md §7):
 *   - Identifiers of the ACTOR and their own organization only. The identifier of an object that was
 *     refused is deliberately absent: it belongs to another tenant, and a denial log is not a place to
 *     collect other communities' ids.
 *   - No names, contacts, token values, transcript text or any other content. The one exception is the
 *     operator's own `reason` on a reason-required grant, which SECURITY.md §12 requires the audit
 *     entry to carry.
 *   - Session ids are opaque identifiers, not credentials; the session TOKEN is never included.
 *
 * Failure cases: a sink that throws must not turn an authorization denial into a 500 - the denial is
 * the outcome that matters - so sink failures are reported and swallowed.
 * Task ownership: T-SEC-001 (denial events), T-SEC-002 (permission decisions), T-ORG-001 (session
 * revocation), T-SEC-007 (durability), T-OBS-002 (transport).
 */

export type AuthorizationOutcome =
  | "DENIED_CROSS_ORGANIZATION"
  | "DENIED_OUTSIDE_MOSQUE_SCOPE"
  | "DENIED_OUTSIDE_EVENT_SCOPE"
  | "DENIED_NOT_OWNED"
  | "DENIED_INVALID_SCOPE"
  | "DENIED_ROLE"
  | "DENIED_NO_ROLE"
  | "DENIED_UNKNOWN_PERMISSION"
  | "DENIED_MISSING_REASON"
  | "DENIED_DEVICE_NOT_BOUND"
  | "DENIED_SEPARATION_OF_DUTIES"
  | "DENIED_SELF_ESCALATION";

export interface AuthorizationDeniedEvent {
  readonly event: "authorization_denied";
  readonly outcome: AuthorizationOutcome;
  readonly actorUserId: string | undefined;
  readonly organizationId: string;
  readonly scopeKind: string;
  /** Entity type only (e.g. "mosque"). Never an identifier of the refused object, never content. */
  readonly targetType: string;
  /** Permission key under evaluation, when the denial came from the authorization guard. */
  readonly permission?: string;
  readonly at: string;
}

/** A reason-required action was allowed; the reason is part of the audit record (SECURITY.md §12). */
export interface AuthorizationReasonRecordedEvent {
  readonly event: "authorization_reason_recorded";
  readonly permission: string;
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly scopeKind: string;
  readonly reason: string;
  readonly at: string;
}

export interface SessionRevokedEvent {
  readonly event: "session_revoked";
  readonly sessionId: string;
  readonly actorUserId: string;
  readonly organizationId: string;
  readonly reason: string;
  readonly at: string;
}

export type SecurityEvent = AuthorizationDeniedEvent | AuthorizationReasonRecordedEvent | SessionRevokedEvent;

export interface SecurityEventSink {
  (event: SecurityEvent): void;
}

const defaultSink: SecurityEventSink = (event) => {
  process.stdout.write(`${JSON.stringify(event)}\n`);
};

let sink: SecurityEventSink = defaultSink;

/** Registers the durable sink (T-SEC-007) or a test recorder. Returns the previous sink. */
export function setSecurityEventSink(next: SecurityEventSink): SecurityEventSink {
  const previous = sink;
  sink = next;
  return previous;
}

export function buildAuthorizationEvent(input: {
  outcome: AuthorizationOutcome;
  actorUserId?: string | undefined;
  organizationId: string;
  scopeKind: string;
  targetType: string;
  permission?: string | undefined;
  now: Date;
}): AuthorizationDeniedEvent {
  const event: AuthorizationDeniedEvent = {
    event: "authorization_denied",
    outcome: input.outcome,
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    scopeKind: input.scopeKind,
    targetType: input.targetType,
    at: input.now.toISOString(),
  };
  return input.permission === undefined ? event : { ...event, permission: input.permission };
}

export function buildReasonRecordedEvent(input: {
  permission: string;
  actorUserId: string;
  organizationId: string;
  scopeKind: string;
  reason: string;
  now: Date;
}): AuthorizationReasonRecordedEvent {
  return {
    event: "authorization_reason_recorded",
    permission: input.permission,
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    scopeKind: input.scopeKind,
    reason: input.reason,
    at: input.now.toISOString(),
  };
}

export function buildSecurityEvent(input: {
  event: "session_revoked";
  sessionId: string;
  actorUserId: string;
  organizationId: string;
  reason: string;
  now: Date;
}): SessionRevokedEvent {
  return {
    event: "session_revoked",
    sessionId: input.sessionId,
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    reason: input.reason,
    at: input.now.toISOString(),
  };
}

/** Emits a security event. Never throws: the caller's own outcome must not be masked by telemetry. */
export function recordSecurityEvent(event: SecurityEvent): void {
  try {
    sink(event);
  } catch {
    process.stdout.write(
      `${JSON.stringify({ event: "security_event_sink_failed", errorCode: "INTERNAL", at: new Date().toISOString() })}\n`,
    );
  }
}

/** Emits an authorization-denied event. @see recordSecurityEvent */
export function recordAuthorizationEvent(event: AuthorizationDeniedEvent): void {
  recordSecurityEvent(event);
}
