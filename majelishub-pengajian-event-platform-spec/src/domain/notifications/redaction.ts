/**
 * Redaction rules: what may never appear in an outbound message.
 *
 * Where this belongs: `src/domain/notifications/` (pure decision), used by the channel adapters and by
 * intent creation validation.
 * Specification: NOTIFICATIONS.md §4/§6, T-NOTIF-004, docs/security/QR-SECURITY.md §5.
 *
 * Invariants:
 *   1. A check-in token, QR payload or short code may travel ONLY through an access-controlled channel.
 *   2. Uncontrolled channels receive a single-use, short-lived redemption link instead.
 *   3. Messages never contain another person's contact details, attendance status of others, or any
 *      "you did not attend" phrasing.
 *   4. Templates are typed by channel class; a token-shaped value in an uncontrolled template throws at
 *      intent creation (fail closed, and alert).
 * Task ownership: T-NOTIF-004.
 */
import type { NotificationChannelControl } from "@/shared/contracts/notifications";

export interface RedactionDecision {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly substituted?: "REDEMPTION_LINK" | "NONE";
}

export interface Redactor {
  /** Detect token-shaped values without logging them (never return the value). */
  classify(text: string): { tokenShaped: boolean };
  decide(channel: NotificationChannelControl, templateKey: string, values: Readonly<Record<string, string>>): RedactionDecision;
}

/** @throws Error("Not implemented: T-NOTIF-004") */
export function redactor(): Redactor {
  throw new Error("Not implemented: T-NOTIF-004");
}
