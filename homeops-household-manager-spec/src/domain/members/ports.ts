// HomeOps — domain skeleton (specification phase). Ports only.
// Owning tasks: T-MEM-001..011.

import type { Id, LocalDate, Role } from '../../shared/types';
import type { Membership } from './types';

export type MembershipRepository = {
  findById(householdId: Id, memberId: Id): Promise<Membership | null>;
  listByHousehold(householdId: Id): Promise<readonly Membership[]>;
  /** Used by recipient resolution: active members with a role, nothing about behaviour. */
  listRecipients(householdId: Id): Promise<readonly Pick<Membership, 'id' | 'role' | 'awayUntil'>[]>;
  insert(membership: Membership): Promise<void>;
  updateRole(householdId: Id, memberId: Id, role: Role): Promise<void>;
  setAway(householdId: Id, memberId: Id, awayUntil: LocalDate | null): Promise<void>;
  /** Must delete sessions and channel subscriptions in the same transaction (I-MEM-003). */
  remove(householdId: Id, memberId: Id): Promise<void>;
  countActiveOwners(householdId: Id): Promise<number>;
};
