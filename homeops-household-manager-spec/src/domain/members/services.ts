// HomeOps — domain skeleton (specification phase). Service contracts only.

import type { Clock } from '../../shared/time/clock';
import type { Id, LocalDate } from '../../shared/types';
import type { MembershipRepository } from './ports';

export type MemberDeps = {
  readonly members: MembershipRepository;
  readonly clock: Clock;
};

/**
 * Invite a member: create a single-use expiring invitation (FR-MEM-003).
 * The raw token is returned once to the caller for the link/email; only its hash is stored.
 *
 * Status: unimplemented by design (specification phase — AGENTS.md §1).
 * Owning task: T-MEM-002 · Requirements, ADR, design, and tests are listed there.
 * The body must stay a single throw until T-MEM-002 is implemented: a fake return
 * value is worse than no implementation (ARCHITECTURE.md, AGENTS.md §8).
 */
export async function inviteMember(
  _deps: MemberDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly email?: string; readonly role: 'ADMIN' | 'MEMBER' | 'HELPER' },
): Promise<{ readonly invitationId: Id; readonly token: string; readonly expiresAt: string }> {
  throw new Error('Not implemented: T-MEM-002');
}

/**
 * Change a role or transfer ownership (FR-MEM-002, FR-MEM-008).
 * Rules: ADMIN cannot act on OWNER; ownership transfer demotes and promotes atomically;
 * at least one OWNER must remain at all times (I-MEM-001, I-XA-003).
 *
 * Status: unimplemented by design (specification phase — AGENTS.md §1).
 * Owning task: T-MEM-003 · Requirements, ADR, design, and tests are listed there.
 * The body must stay a single throw until T-MEM-003 is implemented: a fake return
 * value is worse than no implementation (ARCHITECTURE.md, AGENTS.md §8).
 */
export async function changeMemberRole(
  _deps: MemberDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly memberId: Id; readonly role: 'ADMIN' | 'MEMBER' | 'HELPER' },
): Promise<void> {
  throw new Error('Not implemented: T-MEM-003');
}

export async function transferOwnership(
  _deps: MemberDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly newOwnerMemberId: Id },
): Promise<void> {
  throw new Error('Not implemented: T-MEM-003');
}

/**
 * Remove a member with cascade (FR-MEM-006).
 * Sessions and channel subscriptions die in the same transaction (I-MEM-003); open items
 * are reassigned or unassigned, never silently orphaned (I-MEM-004); history is kept (I-MEM-005).
 *
 * Status: unimplemented by design (specification phase — AGENTS.md §1).
 * Owning task: T-MEM-004 · Requirements, ADR, design, and tests are listed there.
 * The body must stay a single throw until T-MEM-004 is implemented: a fake return
 * value is worse than no implementation (ARCHITECTURE.md, AGENTS.md §8).
 */
export async function removeMember(
  _deps: MemberDeps,
  _input: { readonly householdId: Id; readonly actorMemberId: Id; readonly memberId: Id },
): Promise<void> {
  throw new Error('Not implemented: T-MEM-004');
}

/**
 * Voluntary departure (FR-MEM-007). Blocked for the last OWNER with
 * `LAST_OWNER_CANNOT_LEAVE`; otherwise identical cascade semantics to removal.
 *
 * Status: unimplemented by design (specification phase — AGENTS.md §1).
 * Owning task: T-MEM-005 · Requirements, ADR, design, and tests are listed there.
 * The body must stay a single throw until T-MEM-005 is implemented: a fake return
 * value is worse than no implementation (ARCHITECTURE.md, AGENTS.md §8).
 */
export async function leaveHousehold(
  _deps: MemberDeps,
  _input: { readonly householdId: Id; readonly memberId: Id },
): Promise<void> {
  throw new Error('Not implemented: T-MEM-005');
}

/**
 * Set or clear an away period (FR-MEM-009). Away members stay assignable but are
 * skipped as recipients unless the alert is URGENT (I-ALERT-006).
 *
 * Status: unimplemented by design (specification phase — AGENTS.md §1).
 * Owning task: T-MEM-006 · Requirements, ADR, design, and tests are listed there.
 * The body must stay a single throw until T-MEM-006 is implemented: a fake return
 * value is worse than no implementation (ARCHITECTURE.md, AGENTS.md §8).
 */
export async function setAwayPeriod(
  _deps: MemberDeps,
  _input: { readonly householdId: Id; readonly memberId: Id; readonly awayUntil: LocalDate | null },
): Promise<void> {
  throw new Error('Not implemented: T-MEM-006');
}
