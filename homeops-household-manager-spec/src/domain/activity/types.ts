// HomeOps - domain skeleton (specification phase). Types and value objects only.
// Owning tasks: T-ACT-001..006.

import type { Id, Instant } from '../../shared/types';

/**
 * Append-only household history (DOMAIN.md section 4.12). The catalogue of types is closed and
 * documented in docs/product/ACTIVITY.md; there is deliberately no VIEW, OPEN, or PRESENCE type,
 * and no per-member counting read model may be derived from this table (I-ACT-006, PRIVACY.md PP-9).
 */
export type ActivityType =
  | 'HOUSEHOLD_CREATED'
  | 'HOUSEHOLD_SETTINGS_CHANGED'
  | 'MEMBER_INVITED'
  | 'MEMBER_JOINED'
  | 'MEMBER_ROLE_CHANGED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_LEFT'
  | 'ROOM_CREATED'
  | 'ROOM_UPDATED'
  | 'ROOM_ARCHIVED'
  | 'ROOM_OVERRIDE_SET'
  | 'ROOM_OVERRIDE_EXPIRED'
  | 'CHORE_CREATED'
  | 'CHORE_UPDATED'
  | 'CHORE_PAUSED'
  | 'CHORE_RESUMED'
  | 'CHORE_ARCHIVED'
  | 'CHORE_COMPLETED'
  | 'CHORE_SKIPPED'
  | 'CHORE_SNOOZED'
  | 'CHORE_REASSIGNED'
  | 'CHORE_REOPENED'
  | 'TRASH_STATE_CHANGED'
  | 'TRASH_COLLECTION_ASSIGNED'
  | 'TRASH_COLLECTION_COMPLETED'
  | 'RESOURCE_CREATED'
  | 'RESOURCE_LEVEL_CHANGED'
  | 'RESOURCE_RESTOCKED'
  | 'RESOURCE_MODE_CHANGED'
  | 'SHOPPING_ITEM_ADDED'
  | 'SHOPPING_ITEM_PURCHASED'
  | 'ASSET_CREATED'
  | 'PLAN_CREATED'
  | 'PLAN_PAUSED'
  | 'PLAN_RESUMED'
  | 'SERVICE_RECORDED'
  | 'ISSUE_REPORTED'
  | 'ISSUE_ACKNOWLEDGED'
  | 'ISSUE_PROGRESSED'
  | 'ISSUE_RESOLVED'
  | 'ISSUE_CLOSED'
  | 'ISSUE_COMMENTED'
  | 'ALERT_ACKNOWLEDGED'
  | 'ALERT_SNOOZED'
  | 'ALERT_RESOLVED';

export type ActivityEvent = {
  readonly id: Id;
  readonly householdId: Id;
  /** Absent when the actor was a job or the system, never a fabricated member (docs/product/ACTIVITY.md §Edge cases). */
  readonly actorMemberId?: Id;
  readonly type: ActivityType;
  readonly entity: { readonly kind: string; readonly id: Id };
  /** Snapshot of the display title, so history survives renames and archives (I-ACT-005). */
  readonly summary: string;
  /** Bounded, PII-free: ids, enums, counts. Never free text written by a member (I-ACT-003). */
  readonly metadata?: Readonly<Record<string, string | number>>;
  readonly occurredAt: Instant;
  /** Retention stamp; the prune job deletes past it (I-ACT-004, default 12 months). */
  readonly retainUntil: Instant;
};
