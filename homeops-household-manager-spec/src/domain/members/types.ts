// HomeOps — domain skeleton (specification phase). Types and value objects only.

import type { Id, Instant, LocalDate, Role } from '../../shared/types';

/** Aggregate root of the members module (DOMAIN.md §4.2). */
export type Membership = {
  readonly id: Id;
  readonly householdId: Id;
  readonly userId: Id;
  readonly role: Role;
  readonly displayName: string;
  readonly avatarColor?: string;
  readonly joinedAt: Instant;
  /** While away, this member is skipped as an alert recipient unless the alert is URGENT (FR-MEM-009). */
  readonly awayUntil?: LocalDate;
};

/** Why a specific member received an alert — surfaced by the explain-why view (T-ALERT-025). */
export type RecipientReason = 'ASSIGNED' | 'ROLE' | 'FALLBACK_OWNER' | 'MANUAL';

export type Recipient = {
  readonly memberId: Id;
  readonly reason: RecipientReason;
};
