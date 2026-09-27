// HomeOps — skeleton (specification phase). Contracts only.
// Owning tasks: T-PLAT-002, T-PLAT-007.
// Every function below is intentionally unimplemented. See AGENTS.md §1 and TASKS.md.

/**
 * Cross-cutting domain enums mirrored from PRD.md §6.
 *
 * These are the *only* place status vocabularies are named. Feature code imports
 * them; it must never re-declare a string union locally (NFR-MAINT-004).
 *
 * Presentation of these values (word + shape + colour) is owned by
 * `src/shared/ui/status-badge.tsx` — see docs/design/DESIGN-SYSTEM.md §3.
 */

export const ROOM_STATUS = ['CLEAN', 'NEEDS_ATTENTION', 'DIRTY', 'CLEANING', 'UNKNOWN'] as const;
export type RoomStatus = (typeof ROOM_STATUS)[number]; // ADR-010: no numeric score exists, by design

export const TRASH_STATE = ['EMPTY', 'AVAILABLE', 'ALMOST_FULL', 'FULL', 'COLLECTION_REQUIRED'] as const;
export type TrashState = (typeof TRASH_STATE)[number];

export const RESOURCE_MODE = ['EXACT', 'APPROXIMATE', 'AVAILABLE_UNAVAILABLE'] as const;
export type ResourceMode = (typeof RESOURCE_MODE)[number]; // ADR-011

export const APPROXIMATE_LEVEL = ['FULL', 'ENOUGH', 'LOW', 'CRITICAL', 'EMPTY'] as const;
export type ApproximateLevel = (typeof APPROXIMATE_LEVEL)[number];

export const BINARY_LEVEL = ['AVAILABLE', 'UNAVAILABLE'] as const;
export type BinaryLevel = (typeof BINARY_LEVEL)[number];

export const ALERT_PRIORITY = ['INFO', 'ATTENTION', 'IMPORTANT', 'URGENT'] as const;
export type AlertPriority = (typeof ALERT_PRIORITY)[number];

export const ALERT_STATE = ['OPEN', 'ACKNOWLEDGED', 'SNOOZED', 'RESOLVED', 'EXPIRED'] as const;
export type AlertState = (typeof ALERT_STATE)[number];

export const ALERT_TYPE = [
  'CHORE_DUE',
  'CHORE_OVERDUE',
  'TRASH_FULL',
  'TRASH_COLLECTION_DUE',
  'RESOURCE_LOW',
  'RESOURCE_CRITICAL',
  'MAINTENANCE_DUE',
  'MAINTENANCE_OVERDUE',
  'ISSUE_REQUIRES_ATTENTION',
  'HOUSEHOLD_REMINDER',
] as const;
export type AlertType = (typeof ALERT_TYPE)[number]; // docs/product/ALERTS.md

export const OCCURRENCE_STATUS = [
  'SCHEDULED',
  'IN_PROGRESS',
  'DONE',
  'SKIPPED',
  'SNOOZED',
  'CANCELLED',
] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUS)[number];

export const CHORE_PRIORITY = ['LOW', 'NORMAL', 'HIGH'] as const;
export type ChorePriority = (typeof CHORE_PRIORITY)[number];

export const ISSUE_STATUS = [
  'OPEN',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'WONT_FIX',
] as const;
export type IssueStatus = (typeof ISSUE_STATUS)[number];

export const ISSUE_SEVERITY = ['LOW', 'NORMAL', 'HIGH', 'SAFETY'] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITY)[number]; // SAFETY bypasses quiet hours (I-ISSUE-002)

export const ROLE = ['OWNER', 'ADMIN', 'MEMBER', 'HELPER'] as const;
export type Role = (typeof ROLE)[number]; // docs/security/AUTHZ-MATRIX.md

export const CHANNEL = ['IN_APP', 'PUSH', 'EMAIL'] as const;
export type Channel = (typeof CHANNEL)[number];

/** An all-day value. Always interpreted in the household timezone (I-XA-006). */
export type LocalDate = string; // 'YYYY-MM-DD'
/** An instant. Always stored as UTC with an offset (ADR-007). */
export type Instant = string; // ISO-8601
/** Opaque, UUIDv7, never sequential (FR-HH-012). */
export type Id = string;
