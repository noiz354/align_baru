/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/**
 * Notification channels (ADR-0021). In-app is primary and the only channel implemented in Phase 0
 * (and it is a stub). No financial state may depend on delivery (FR-NOTIF-007).
 */
export type ChannelKind = "IN_APP" | "WEB_PUSH" | "EMAIL" | "WHATSAPP" | "SMS";

export interface NotificationPayload {
  readonly organizationId: string;
  readonly recipientUserIds: readonly string[];
  readonly templateId: string;
  /** The template renders the minimal prompt; detail stays in the app (FR-NOTIF-004). */
  readonly variables: Readonly<Record<string, string>>;
  readonly severity: "INFO" | "ATTENTION" | "URGENT";
  readonly subjectRef: { readonly kind: string; readonly id: string };
}

export interface NotificationChannel {
  readonly kind: ChannelKind;
  send(payload: NotificationPayload): Promise<{ readonly attemptId: string }>;
}

/** Throws. Task: T-ALERT-001. */
export function createChannel(_kind: ChannelKind): NotificationChannel {
  throw new Error("Not implemented: T-ALERT-001");
}
