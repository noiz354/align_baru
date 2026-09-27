/**
 * Security-event -> audit bridge.
 *
 * Where this belongs: server/audit. `src/server/auth/authorization-events.ts` produces security events
 * synchronously (a route handler cannot await inside a permission check); this module collects them into
 * a buffer that the request's own transaction flushes, so the audit entry commits or rolls back with the
 * action it describes (TASKS.md T-SEC-007: "audit writes never block the audited action beyond the
 * transaction it belongs to", SECURITY.md §12).
 *
 * The buffer is per-request state, passed explicitly - never a module-level singleton, because a global
 * sink would leak one request's events into another's transaction.
 *
 * Failure cases: a flush with no events is a no-op · an event that carries no organization id is
 * reported as an error rather than written as a chain entry in the wrong partition.
 *
 * Task ownership: T-SEC-007 (delivered 2026-09-27).
 */
import type { DbHandle } from "@/server/db/client";
import type { AuditEntry } from "@/shared/contracts/audit";
import type { SecurityEvent } from "@/server/auth/authorization-events";
import { writeAuditEntry, type AuditWriteInput } from "@/server/audit/writer";

export interface AuditEventSink {
  /** Records an event for the enclosing transaction. Never throws. */
  push(event: SecurityEvent): void;
}

export interface AuditEventBuffer extends AuditEventSink {
  readonly events: readonly SecurityEvent[];
  /** Writes every buffered event, in order, and empties the buffer. Returns the written entries. */
  flush(handle: DbHandle): Promise<AuditEntry[]>;
}

/** Creates a per-request buffer. */
export function createAuditEventBuffer(): AuditEventBuffer {
  const events: SecurityEvent[] = [];
  return {
    events,
    push(event: SecurityEvent): void {
      events.push(event);
    },
    async flush(handle: DbHandle): Promise<AuditEntry[]> {
      const written: AuditEntry[] = [];
      while (events.length > 0) {
        const event = events.shift();
        if (!event) break;
        written.push(await writeAuditEntry(securityEventToAuditInput(event), handle));
      }
      return written;
    },
  };
}

/**
 * Maps a security event onto an audit entry.
 *
 * Denials carry no target identifier on purpose (authorization-events.ts): an identifier of an object
 * that was refused belongs to another tenant, and the audit trail is not a place to collect them.
 */
export function securityEventToAuditInput(event: SecurityEvent): AuditWriteInput {
  switch (event.event) {
    case "authorization_denied":
      return {
        actionKey: event.permission ?? event.targetType,
        organizationId: event.organizationId,
        ...(event.actorUserId === undefined ? {} : { actorUserId: event.actorUserId }),
        ...(event.actorRole === undefined ? {} : { actorRole: event.actorRole }),
        scopeKind: event.scopeKind,
        targetType: "authorization",
        // The outcome is the auditable fact ("why was this refused"), not content.
        targetId: event.outcome,
      };
    case "authorization_reason_recorded":
      return {
        actionKey: event.permission,
        organizationId: event.organizationId,
        actorUserId: event.actorUserId,
        ...(event.actorRole === undefined ? {} : { actorRole: event.actorRole }),
        scopeKind: event.scopeKind,
        targetType: "authorization",
        targetId: "GRANTED_WITH_REASON",
        reason: event.reason,
      };
    case "session_revoked":
      return {
        actionKey: "session.revoke",
        organizationId: event.organizationId,
        actorUserId: event.actorUserId,
        scopeKind: "ORG",
        targetType: "session",
        // A session id is an opaque identifier, not a credential (SECURITY.md §11).
        targetId: event.sessionId,
        reason: event.reason,
      };
    default: {
      const unhandled: never = event;
      throw new Error(`Unhandled security event: ${JSON.stringify(unhandled)}`);
    }
  }
}
