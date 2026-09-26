// HomeOps - feature skeleton (specification phase). DTO contracts only.
// Owning tasks: T-DASH-001.

import type { Role } from '../../shared/types';

/** Never exposes another member's private fields - there is no such field in this shape (PRIVACY.md PP-9). */
export type MemberSummaryDto = {
  readonly id: string;
  readonly displayName: string;
  readonly role: Role;
  readonly avatarInitials: string;
  readonly awayUntil?: string;
};

export type HouseholdDto = {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  /** Household-local date, computed server-side; the client never derives "today" (I-XA-006). */
  readonly today: string;
  readonly members: readonly MemberSummaryDto[];
};
