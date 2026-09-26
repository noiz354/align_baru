// HomeOps - feature skeleton (specification phase). Pure policy only: no I/O, no ports, no clock reads.

import type { AlertPriority, AlertType, Channel, LocalDate } from '../../shared/types';
import type { Recipient } from '../../domain/members/types';

/**
 * Everything the policy layer needs to decide a delivery. Explicit inputs mean the decision is
 * reproducible in a unit test without a database (I-NOTIF-003).
 */
export type NotificationDecisionInput = {
  readonly alertId: string;
  readonly householdId: string;
  readonly alertType: AlertType;
  readonly priority: AlertPriority;
  readonly recipients: readonly Recipient[];
  readonly candidates: readonly {
    readonly memberId: string;
    readonly awayUntil?: LocalDate;
    readonly preferences: MemberChannelPreferences;
    readonly deliveredToday: number;
  }[];
  readonly householdQuietHours?: { readonly start: string; readonly end: string };
  readonly householdDailyCapCeiling: number;
  readonly windowKey: string;
  readonly localNow: string;
  readonly localToday: LocalDate;
};

export type MemberChannelPreferences = {
  readonly channels: Readonly<Record<Channel, boolean>>;
  /** INFO stays informational: no push unless the member explicitly opts in. */
  readonly quietHoursOverride?: { readonly start: string; readonly end: string };
  readonly dailyCap: number;
};

export type SuppressionReason =
  | 'QUIET_HOURS' | 'CAP_REACHED' | 'AWAY' | 'CHANNEL_DISABLED' | 'DUPLICATE' | 'NO_RECIPIENT' | 'STALE';

export type NotificationIntent = {
  readonly alertId: string;
  readonly memberId: string;
  readonly channel: Channel;
  /** Makes intents unique per (alert, member, channel, window) - duplicate delivery is impossible (I-NOTIF-001). */
  readonly windowKey: string;
  /** Minimal by default; verbose members opt in. Never contains notes, comments, or photos (I-NOTIF-004). */
  readonly payload: { readonly title: string; readonly body: string; readonly href: string };
};

export type NotificationDecision = {
  readonly intents: readonly NotificationIntent[];
  readonly suppressed: readonly { readonly memberId: string; readonly reason: SuppressionReason }[];
};

/**
 * decideNotifications - the single decision point for delivery (FR-NOTIF-002/010).

 * Contract (docs/product/NOTIFICATIONS.md):
 *  - in-app is always available: this function decides *delivery*, it never hides the alert;
 *  - recipient resolution is already done (assigned -> role -> owner fallback, I-ALERT-006);
 *  - away members are skipped unless the alert is URGENT;
 *  - quiet hours (household default plus a member override) suppress, never cancel; suppressed items
 *    are queued to the next allowed window and dropped as STALE if the condition resolved;
 *  - caps count *delivered* intents, not alerts, and overflow becomes one digest per window;
 *  - URGENT deliveries bypass quiet hours and are still counted;
 *  - duplicates are suppressed by (alertId, memberId, channel, windowKey).
 * Pure: no clock reads, no database, no channel adapters - the largest unit suite in the app hangs
 * off this function (tests/unit/features/notifications/policy.test.ts).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-NOTIF-002 - requirements, ADR, design, and tests are listed there.
 */
export function decideNotifications(_input: NotificationDecisionInput): NotificationDecision {
  throw new Error('Not implemented: T-NOTIF-002');
}

/**
 * Build the push payload for an intent (FR-NOTIF-003). Minimal by default:
 * "HomeOps - something needs attention" plus a deep link. Verbose mode (opt-in per member) may add
 * the alert type and the entity name only. A lock screen is a public surface: no notes, comments,
 * photos, or member names ever appear here (PRIVACY.md section 8, I-NOTIF-004).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-NOTIF-008 - requirements, ADR, design, and tests are listed there.
 */
export function buildPushPayload(_input: {
  readonly alertType: AlertType;
  readonly entityName?: string;
  readonly verbose: boolean;
  readonly href: string;
}): { readonly title: string; readonly body: string; readonly tag: string } {
  throw new Error('Not implemented: T-NOTIF-008');
}
