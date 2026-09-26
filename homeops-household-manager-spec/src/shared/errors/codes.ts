// HomeOps — skeleton (specification phase). Contracts only.
// Owning tasks: T-PLAT-007.
// Every function below is intentionally unimplemented. See AGENTS.md §1 and TASKS.md.

/**
 * The complete domain error vocabulary. Codes are permanent once released
 * (docs/api/CONVENTIONS.md §10). Semantics: docs/domain/ERRORS.md.
 * Transport + copy mapping: docs/api/ERROR-CATALOG.md.
 */
export const ERROR_CODES = [
  // cross-cutting
  'VALIDATION_FAILED', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'ALREADY_EXISTS',
  'RATE_LIMITED', 'FEATURE_NOT_AVAILABLE', 'INTERNAL',
  // household, membership, auth
  'HOUSEHOLD_NOT_FOUND', 'LAST_OWNER_CANNOT_LEAVE', 'OWNER_TRANSFER_REQUIRED',
  'MEMBER_ALREADY_IN_HOUSEHOLD', 'INVITE_EXPIRED', 'INVITE_ALREADY_USED',
  'QUIET_HOURS_INVALID', 'TIMEZONE_INVALID', 'SESSION_EXPIRED', 'SESSION_REVOKED',
  'ROLE_NOT_PERMITTED',
  // rooms
  'ROOM_NAME_TAKEN', 'ROOM_IN_USE', 'ROOM_OVERRIDE_EXPIRED', 'ROOM_OVERRIDE_TOO_LONG', 'ROOM_LIMIT_REACHED',
  // chores & recurrence
  'OCCURRENCE_ALREADY_OPEN', 'OCCURRENCE_NOT_OPEN', 'OCCURRENCE_STALE', 'SNOOZE_TOO_LONG',
  'SKIP_REASON_REQUIRED', 'REOPEN_WINDOW_CLOSED', 'RECURRENCE_RULE_INVALID',
  'RECURRENCE_INTERVAL_INVALID', 'DEFINITION_ARCHIVED', 'ADHOC_REQUIRES_TITLE',
  // trash
  'TRASH_INVALID_TRANSITION', 'TRASH_RESET_REASON_REQUIRED', 'CONTAINER_ARCHIVED', 'TRASH_NAME_TAKEN',
  // resources & shopping
  'RESOURCE_MODE_MISMATCH', 'RESOURCE_LEVEL_INVALID', 'RESOURCE_THRESHOLD_INVALID',
  'RESOURCE_NAME_TAKEN', 'RESOURCE_MODE_CHANGE_REQUIRES_CONFIRM', 'SHOPPING_ITEM_ALREADY_BOUGHT',
  // maintenance
  'FREQUENCY_INVALID', 'LEAD_TIME_INVALID', 'SERVICE_DATE_IN_FUTURE', 'ASSET_NAME_TAKEN',
  'RECORD_TARGET_INVALID', 'PLAN_ALREADY_PAUSED',
  // issues
  'ISSUE_INVALID_TRANSITION', 'ISSUE_CLOSED_READONLY', 'ISSUE_TITLE_REQUIRED',
  'ISSUE_CLOSE_NOT_PERMITTED', 'ISSUE_WONT_FIX_REASON_REQUIRED', 'COMMENT_BODY_INVALID', 'ATTACHMENT_REJECTED',
  // alerts
  'ALERT_TERMINAL', 'ALERT_ALREADY_ACKNOWLEDGED', 'ALERT_NOT_ASSIGNED_TO_YOU',
  'SNOOZE_ALREADY_ACTIVE', 'DEDUPE_CONFLICT',
  // notifications
  'CHANNEL_DISABLED', 'PUSH_PERMISSION_DENIED', 'SUBSCRIPTION_INVALID',
  'TEST_NOTIFICATION_LIMIT', 'EMAIL_NOT_CONFIGURED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** A domain error is an expected outcome, never a thrown surprise (docs/api/CONVENTIONS.md §2). */
export type DomainError = {
  readonly code: ErrorCode;
  /** Developer-facing English for logs and tests. Never shown to a member (DESIGN.md §17). */
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number>>;
};

/** Resolution reasons recorded on alert transitions (docs/product/ALERTS.md §Lifecycle). */
export const RESOLUTION_REASON = [
  'COMPLETED', 'COLLECTED', 'RESTOCKED', 'SERVICE_RECORDED', 'ACKNOWLEDGED_ISSUE',
  'SKIPPED', 'CANCELLED', 'PAUSED', 'RESET', 'ARCHIVED', 'EXPIRED', 'MANUAL',
] as const;
export type ResolutionReason = (typeof RESOLUTION_REASON)[number];
