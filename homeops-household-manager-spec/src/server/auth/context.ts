// HomeOps - server skeleton (specification phase). Boundary contract only.

import type { Id, Role } from '../../shared/types';

/**
 * The single place a household context is minted (ADR-005, I-XA-002).
 *
 * Rules enforced here and nowhere else:
 *  - the household id comes from the session, never from a request payload;
 *  - a session without an active membership produces HOUSEHOLD_NOT_FOUND (no leakage of existence);
 *  - the returned object is the only thing a repository may be scoped with.
 *
 * Status: unimplemented by design. Owning task: T-HH-003.
 */
export type HouseholdContext = {
  readonly householdId: Id;
  readonly memberId: Id;
  readonly userId: Id;
  readonly role: Role;
  readonly timezone: string;
};

export async function requireHouseholdContext(): Promise<HouseholdContext> {
  throw new Error('Not implemented: T-HH-003');
}
