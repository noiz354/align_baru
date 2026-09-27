// HomeOps - domain skeleton (specification phase). Types and value objects only.
// Owning tasks: T-TRASH-001..012.

import type { Id, Instant, LocalDate, TrashState } from '../../shared/types';

export type TrashContainer = {
  readonly id: Id;
  readonly householdId: Id;
  readonly name: string;
  readonly kind: 'ORGANIC' | 'RECYCLABLE' | 'GENERAL' | 'HAZARDOUS' | 'BULKY';
  readonly locationNote?: string;
  readonly state: TrashState;
  /** Weekdays the collection happens (0 = Sunday). Empty means "no schedule". */
  readonly collectionWeekdays: readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[];
  /** Local time by which the bin must be out, e.g. '07:00'. */
  readonly outBy?: string;
  readonly assigneeMemberId?: Id;
  readonly archivedAt?: Instant;
};

/**
 * Every state change is an event, never an overwritten value (FR-TRASH-006, I-TRASH-002).
 * Reasons are an enum so history stays analysable without free text.
 */
export type TrashStateEvent = {
  readonly id: Id;
  readonly containerId: Id;
  readonly from: TrashState;
  readonly to: TrashState;
  readonly reason:
    'MARKED_ALMOST_FULL' | 'MARKED_FULL' | 'COLLECTED' | 'RESET' | 'COLLECTION_MISSED' | 'ARCHIVED';
  readonly actorMemberId?: Id; // undefined for job-driven transitions
  readonly note?: string;
  readonly occurredAt: Instant;
};

export type CollectionDue = {
  readonly containerId: Id;
  readonly dueOn: LocalDate;
  readonly outBy?: string;
};
