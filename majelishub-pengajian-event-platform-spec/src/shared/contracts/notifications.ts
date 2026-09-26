/**
 * Notification contracts.
 * Specification: NOTIFICATIONS.md (~23 template keys, classes essential/optional/operational),
 * ADR-0015 (dedupe), T-NOTIF-004 (no tokens over uncontrolled channels).
 * Invariants:
 *   1. Every intent has a `dedupeKey`; `UNIQUE (dedupe_key)` guarantees one delivery per fact.
 *   2. Channel classification is data: ACCESS_CONTROLLED (in-app, participant code page) vs
 *      UNCONTROLLED (email, future SMS/WhatsApp). Tokens may only travel through controlled channels.
 *   3. Quiet hours 21:00-06:00 venue-local; only the documented essential class may bypass.
 *   4. Templates are typed per channel class; a token-shaped value in an uncontrolled template is a
 *      validation error at intent creation.
 */
export type NotificationClass = "ESSENTIAL" | "OPTIONAL" | "OPERATIONAL";
export type NotificationChannelKind = "IN_APP" | "EMAIL";
export type NotificationChannelControl = "ACCESS_CONTROLLED" | "UNCONTROLLED";

export interface NotificationIntent {
  readonly templateKey: string;       // one of the catalogue keys
  readonly class: NotificationClass;
  readonly channels: readonly NotificationChannelKind[];
  readonly dedupeKey: string;
  readonly organizationId: string;
  readonly recipientRef: string;      // reference, never a raw address in the intent
  readonly payloadRefs: Readonly<Record<string, string>>; // ids only; rendering happens in the channel adapter
}

/** Redemption link for a code that may only be read after authentication (T-NOTIF-004). */
export interface RedemptionLink {
  readonly token: string;             // single-use, short-lived, never logged
  readonly expiresAt: string;
}
