/**
 * Channel policy: which content may travel through which channel.
 *
 * Where this belongs: features/notifications, using the pure redactor from domain/notifications.
 * Specification: NOTIFICATIONS.md §4/§6, TASKS.md T-NOTIF-004, SECURITY.md §6.
 * Invariants: ACCESS_CONTROLLED channels (in-app, the authenticated participant code page) may carry a
 *   token; UNCONTROLLED channels (email, future SMS/WhatsApp) may carry only a single-use redemption
 *   link; a token-shaped value in an uncontrolled template is rejected at intent creation and alerted;
 *   reminders never reveal another person's data, and never phrase anything as "you did not attend".
 * Privacy: minimal content in messages; the recipient's contact is a reference, not inline content.
 * Task ownership: T-NOTIF-004.
 */
import type { NotificationChannelControl, NotificationChannelKind } from "@/shared/contracts/notifications";

export const CHANNEL_CONTROL: Readonly<Record<NotificationChannelKind, NotificationChannelControl>> = {
  IN_APP: "ACCESS_CONTROLLED",
  EMAIL: "UNCONTROLLED",
};

/** @throws Error("Not implemented: T-NOTIF-002") */
export function assertTemplateAllowed(input: { templateKey: string; channel: NotificationChannelKind; values: Readonly<Record<string, string>> }): void {
  throw new Error("Not implemented: T-NOTIF-002");
}
