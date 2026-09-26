// HomeOps — domain skeleton (specification phase). Ports only; adapters live in src/server/db.

import type { Id } from '../../shared/types';
import type { Household, HouseholdSettings, Invitation } from './types';

/**
 * Household scoping (I-XA-001 / I-XA-001a): reads take `householdId` as the first parameter, and
 * creates take an aggregate root that already declares `householdId`. The single documented
 * exception is `findMembershipHousehold(memberId)` - the session-bootstrap lookup that resolves
 * *which* household a member belongs to, so it cannot take a householdId by definition. It has its
 * own row in the T-SEC-002 isolation sweep. Adapters never expose any other unscoped read.
 */
export type HouseholdRepository = {
  findById(householdId: Id): Promise<Household | null>;
  findMembershipHousehold(memberId: Id): Promise<Household | null>;
  insert(household: Household): Promise<void>;
  update(household: Household): Promise<void>;
  updateSettings(settings: HouseholdSettings): Promise<void>;
  findSettings(householdId: Id): Promise<HouseholdSettings | null>;
};

export type InvitationRepository = {
  insert(invitation: Invitation): Promise<void>;
  /** Accepting an invitation is a compare-and-set: expired/used/revoked return null. */
  consumeByTokenHash(tokenHash: string, now: Date): Promise<Invitation | null>;
  listPending(householdId: Id): Promise<readonly Invitation[]>;
  revoke(householdId: Id, invitationId: Id): Promise<void>;
};

/** Reads and destroys everything a household owns, in dependency order (T-HH-006, RUNBOOK §10). */
export type HouseholdExportPort = {
  collectForExport(householdId: Id): Promise<unknown>;
};
