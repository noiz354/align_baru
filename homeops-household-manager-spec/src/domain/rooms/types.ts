// HomeOps - domain skeleton (specification phase). Types and value objects only.

import type { Id, Instant, LocalDate, RoomStatus } from '../../shared/types';

export type Room = {
  readonly id: Id;
  readonly householdId: Id;
  readonly name: string;
  readonly groupLabel?: string;
  readonly sortOrder: number;
  /** Excluded from derivation, dashboards, and alert evaluation - but never destroyed (I-ROOM-005). */
  readonly notInUse: boolean;
  readonly archivedAt?: Instant;
  readonly notes?: string;
};

/**
 * A deliberate correction of reality, not a status field.
 * At most one active override per room (I-ROOM-002); it wins over every derived rule (I-ROOM-003).
 * Attribution is visible to all members: overrides are never anonymous.
 */
export type StatusOverride = {
  readonly id: Id;
  readonly roomId: Id;
  readonly status: RoomStatus;
  readonly reason: string;
  readonly setByMemberId: Id;
  readonly setAt: Instant;
  /** Bounded by HouseholdSettings.roomOverrideMaxHours; expiry is swept by a job (T-ROOM-004). */
  readonly expiresAt: Instant;
};

/**
 * The derivation inputs. Deliberately *evidence*, not another module aggregates entities:
 * rooms receives the facts it needs for the ADR-010 rule set as primitives, which keeps the
 * dependency one-way (rooms never imports chores - docs/architecture/MODULE-MAP.md).
 */
export type RoomEvidence = {
  readonly activeOverride?: StatusOverride;
  readonly openOccurrences: readonly {
    readonly choreTitle: string;
    readonly inProgress: boolean;
    readonly dueAtLocalDate: LocalDate;
    readonly overdue: boolean;
  }[];
  readonly lastCompletion: { readonly choreTitle: string; readonly completedAt: Instant } | null;
  /** Household "today" - never a UTC date (I-XA-006). */
  readonly today: LocalDate;
  /** Days after a completion during which the room still counts as CLEAN (default 7). */
  readonly cleanRecencyDays: number;
};

/** The derived answer, always with the evidence a member can read (DESIGN.md section 17, T-2). */
export type RoomStatusResult = {
  readonly status: RoomStatus;
  /** Plain-language reason, e.g. 'Deep clean is 2 days overdue'. */
  readonly reason: string;
  /** Which rule produced it - used by tests and the "why is this flagged?" surface (rule number 1-6). */
  readonly ruleNumber: 1 | 2 | 3 | 4 | 5 | 6;
};
