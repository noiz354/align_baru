// HomeOps — domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id } from '../../shared/types';
import type { HouseholdRepository, InvitationRepository } from './ports';
import type { Household, HouseholdSettings } from './types';

export type HouseholdDeps = {
  readonly households: HouseholdRepository;
  readonly invitations: InvitationRepository;
  readonly clock: Clock;
};

/**
 * Create a household and make the creator its first OWNER (FR-HH-001, FR-HH-002).
 * One transaction: household row, membership row, default settings.
 *
 * Status: unimplemented by design (specification phase — AGENTS.md §1).
 * Owning task: T-HH-001 · Requirements, ADR, design, and tests are listed there.
 * The body must stay a single throw until T-HH-001 is implemented: a fake return
 * value is worse than no implementation (ARCHITECTURE.md, AGENTS.md §8).
 */
export async function createHousehold(
  _deps: HouseholdDeps,
  _input: { readonly name: string; readonly timezone: string; readonly createdByUserId: Id },
): Promise<Household> {
  throw new Error('Not implemented: T-HH-001');
}

/**
 * Update household name/timezone/settings (FR-HH-007).
 * A timezone change affects future materialised dates only — existing occurrences keep
 * the dates they were created with (I-HH-004, I-XA-006).
 *
 * Status: unimplemented by design (specification phase — AGENTS.md §1).
 * Owning task: T-HH-002 · Requirements, ADR, design, and tests are listed there.
 * The body must stay a single throw until T-HH-002 is implemented: a fake return
 * value is worse than no implementation (ARCHITECTURE.md, AGENTS.md §8).
 */
export async function updateHouseholdSettings(
  _deps: HouseholdDeps,
  _input: {
    readonly householdId: Id;
    readonly actorMemberId: Id;
    readonly patch: Partial<HouseholdSettings>;
  },
): Promise<HouseholdSettings> {
  throw new Error('Not implemented: T-HH-002');
}

/**
 * Archive a household: read-only for every operation except export and deletion
 * (FR-HH-010, I-HH-002). Hard deletion is an operator procedure (RUNBOOK §10), never a member action.
 *
 * Status: unimplemented by design (specification phase — AGENTS.md §1).
 * Owning task: T-HH-005 · Requirements, ADR, design, and tests are listed there.
 * The body must stay a single throw until T-HH-005 is implemented: a fake return
 * value is worse than no implementation (ARCHITECTURE.md, AGENTS.md §8).
 */
export async function archiveHousehold(
  _deps: HouseholdDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id },
): Promise<void> {
  throw new Error('Not implemented: T-HH-005');
}

/**
 * Collect a household export (FR-SET-005, PRIVACY.md §7).
 * Owner-only, rate limited, audited. Contains what members already see — never another
 * household, never operator logs.
 *
 * Status: unimplemented by design (specification phase — AGENTS.md §1).
 * Owning task: T-HH-006 · Requirements, ADR, design, and tests are listed there.
 * The body must stay a single throw until T-HH-006 is implemented: a fake return
 * value is worse than no implementation (ARCHITECTURE.md, AGENTS.md §8).
 */
export async function exportHouseholdData(
  _deps: HouseholdDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id },
): Promise<{ readonly archive: unknown }> {
  throw new Error('Not implemented: T-HH-006');
}
