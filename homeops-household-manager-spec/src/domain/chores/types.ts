// HomeOps - domain skeleton (specification phase). Types and value objects only.

import type { ChorePriority, Id, Instant, LocalDate, OccurrenceStatus } from '../../shared/types';

/**
 * The intention. Edited rarely; occurrences are materialised from it (ADR-006).
 * Editing a definition never rewrites history (I-CHORE-007).
 */
export type ChoreDefinition = {
  readonly id: Id;
  readonly householdId: Id;
  readonly title: string;
  readonly roomId?: Id;
  readonly assigneeMemberId?: Id;
  readonly priority: ChorePriority;
  readonly recurrence: RecurrenceRule;
  readonly estimatedMinutes?: number;
  readonly notes?: string;
  readonly pausedAt?: Instant;
  readonly archivedAt?: Instant;
  readonly createdByMemberId: Id;
  readonly createdAt: Instant;
};

/**
 * A slot in a schedule. At most one occurrence per definition may be open at a time -
 * enforced by a partial unique index, not by convention (I-CHORE-001, FR-CHORE-017).
 */
export type ChoreOccurrence = {
  readonly id: Id;
  readonly householdId: Id;
  readonly definitionId?: Id;
  /** Deterministic per slot: `<definitionId>:<slotDate>` - makes retries and late ticks safe (I-CHORE-003). */
  readonly occurrenceKey: string;
  readonly source: 'DEFINITION' | 'AD_HOC';
  /** Snapshots so history survives renames and archives (I-CHORE-007, I-ACT-005). */
  readonly titleSnapshot: string;
  readonly roomIdSnapshot?: Id;
  readonly dueOn: LocalDate;
  readonly status: OccurrenceStatus;
  readonly assigneeMemberId?: Id;
  readonly snoozedUntil?: Instant;
  readonly completedAt?: Instant;
  readonly completedByMemberId?: Id;
  readonly skippedReason?: 'AWAY' | 'NOT_NEEDED' | 'CAME_UP' | 'OTHER';
  readonly cancelledReason?: 'PAUSED' | 'ARCHIVED' | 'ROOM_ARCHIVED';
  /** Set when a definition edit happened after materialisation (surfaced as a note - T-CHORE-013). */
  readonly definitionChangedAt?: Instant;
};

/**
 * Recurrence as a discriminated union so every rule family is exhaustively handled
 * and can be rendered back as words (docs/product/RECURRENCE.md, ADR-007).
 */
export type RecurrenceRule =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'DAILY' }
  | { readonly kind: 'WEEKDAYS'; readonly weekdays: readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[] } // 0 = Sunday
  | { readonly kind: 'EVERY_N_DAYS'; readonly interval: number; readonly anchor: LocalDate }
  | {
      readonly kind: 'EVERY_N_WEEKS';
      readonly interval: number;
      readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
      readonly anchor: LocalDate;
    }
  | { readonly kind: 'MONTHLY'; readonly dayOfMonth: number } // 1-31, clamped per month (I-MNT-005)
  | {
      readonly kind: 'EVERY_N_MONTHS';
      readonly interval: number;
      readonly dayOfMonth: number;
      readonly anchor: LocalDate;
    }
  | { readonly kind: 'AFTER_COMPLETION'; readonly intervalDays: number }; // anchored to the last completion (I-CHORE-004)

export type ChoreSummary = {
  readonly occurrence: ChoreOccurrence;
  readonly definition?: Pick<
    ChoreDefinition,
    'id' | 'recurrence' | 'priority' | 'roomId' | 'assigneeMemberId'
  >;
  readonly isOverdue: boolean;
};
