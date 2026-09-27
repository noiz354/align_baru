// HomeOps - domain skeleton (specification phase). Types and value objects only.

import type { AlertPriority, AlertState, AlertType, Id, Instant, LocalDate } from '../../shared/types';
import type { ResolutionReason } from '../../shared/errors/codes';
import type { ChoreOccurrence } from '../chores/types';
import type { TrashContainer } from '../trash/types';
import type { Resource } from '../resources/types';
import type { MaintenancePlan } from '../maintenance/types';
import type { Issue } from '../issues/types';

/**
 * An alert is the domain saying "someone needs to act, why, and who" - exactly once, to the right
 * person (docs/product/ALERTS.md, ADR-008). Notification *delivery* is a separate concern and is
 * never modelled here (FR-NOTIF-001).
 */
export type Alert = {
  readonly id: Id;
  readonly householdId: Id;
  readonly type: AlertType;
  readonly state: AlertState;
  readonly priority: AlertPriority;
  /** Deterministic per condition; at most one non-terminal alert per key (I-ALERT-001). */
  readonly dedupeKey: string;
  /** Which entity the alert is about - never free text, never PII in the key. */
  readonly entity: { readonly kind: string; readonly id: Id };
  readonly recipientMemberId: Id;
  readonly recipientReason: 'ASSIGNED' | 'ROLE' | 'FALLBACK_OWNER' | 'MANUAL';
  /** When action is expected, used by the UI to phrase "before Tuesday morning" (question 5). */
  readonly expectedBy?: Instant;
  readonly firstDetectedAt: Instant;
  readonly lastRefreshedAt: Instant;
  readonly acknowledgedAt?: Instant;
  readonly acknowledgedByMemberId?: Id;
  readonly snoozedUntil?: Instant;
  readonly escalatedAt?: Instant;
  readonly resolvedAt?: Instant;
  readonly resolutionReason?: ResolutionReason;
  readonly expiredAt?: Instant;
};

/** Append-only: every state change is recorded with actor and reason (I-ALERT-006 in DOMAIN.md). */
export type AlertTransition = {
  readonly id: Id;
  readonly alertId: Id;
  readonly from: AlertState | null;
  readonly to: AlertState;
  readonly actorMemberId?: Id; // absent for job-driven transitions
  readonly reason?: ResolutionReason;
  readonly note?: string;
  readonly occurredAt: Instant;
};

/** The five questions every alert must answer; creation fails validation if any is missing. */
export type AlertContent = {
  readonly whatHappened: string;
  readonly whyItMatters: string;
  readonly whoShouldAct: { readonly memberId: Id; readonly displayName: string; readonly reason: string };
  readonly availableAction: { readonly label: string; readonly href: string };
  readonly expectedBy?: { readonly instant: Instant; readonly phrase: string };
};

/** A condition detected in household state, before reconciliation against existing alerts. */
export type DetectedCondition = {
  readonly type: AlertType;
  readonly dedupeKey: string;
  readonly entity: { readonly kind: string; readonly id: Id };
  readonly priority: AlertPriority;
  readonly priorityReason: string;
  readonly expectedBy?: Instant;
  /** Grouped types (resources) carry the item list so the body can name critical items. */
  readonly detail?: {
    readonly items?: readonly { readonly name: string; readonly band: 'LOW' | 'CRITICAL' }[];
    readonly today?: LocalDate;
  };
};

/** Everything the pure engine may read. No ports, no clock reads, no I/O (T-ALERT-004). */
export type AlertEvaluationInput = {
  readonly householdId: Id;
  readonly today: LocalDate;
  readonly householdTimezone: string;
  readonly nowInstant: string;
  readonly openOccurrences: readonly ChoreOccurrence[];
  readonly containers: readonly TrashContainer[];
  readonly lowResources: readonly Resource[];
  readonly duePlans: readonly MaintenancePlan[];
  readonly openIssues: readonly Issue[];
  readonly existingAlerts: readonly Alert[];
  readonly policy: {
    readonly snoozeMaxHours: number;
    readonly escalationDelayHours: number;
    readonly infoExpiryDays: number;
  };
};

export type AlertEvaluationResult = {
  readonly toCreate: readonly DetectedCondition[];
  readonly toRefresh: readonly { readonly alertId: Id; readonly next: DetectedCondition }[];
  readonly toEscalate: readonly Id[];
  readonly toResolve: readonly { readonly alertId: Id; readonly reason: ResolutionReason }[];
  readonly toExpire: readonly Id[];
};
