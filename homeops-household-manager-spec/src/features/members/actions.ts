'use server';

// HomeOps - feature skeleton (specification phase). Server Action shells only.
// Every action: validate shape -> authorize -> call a domain service -> map to OperationResult.
// No action contains business rules; those live in src/domain (docs/architecture/MODULE-MAP.md).

import type { OperationResult } from '../../shared/errors/result';

/**
 * Invite a member (FR-MEM-003). Returns the one-time invite URL/token to the caller;
 * only the hash is stored. OWNER/ADMIN only, 20 invitations per day.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MEM-002 - requirements, ADR, design, and tests are listed there.
 */
export async function inviteMemberAction(
  _input: { readonly email?: string; readonly role: 'ADMIN' | 'MEMBER' | 'HELPER' },
): Promise<OperationResult<{ readonly inviteUrl: string; readonly expiresAt: string }>> {
  throw new Error('Not implemented: T-MEM-002');
}

/**
 * Change a role or transfer ownership (FR-MEM-002/008). Server-side role checks; the
 * last-owner rule is enforced in the domain, not in the UI.
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MEM-003 - requirements, ADR, design, and tests are listed there.
 */
export async function changeMemberRoleAction(
  _input: { readonly memberId: string; readonly role: 'ADMIN' | 'MEMBER' | 'HELPER' | 'OWNER' },
): Promise<OperationResult<{ readonly updated: true }>> {
  throw new Error('Not implemented: T-MEM-003');
}

/**
 * Remove a member (FR-MEM-006). Sessions and push subscriptions die in the same
 * transaction; open work is reassigned or unassigned (I-MEM-003, I-MEM-004).
 *
 * Status: unimplemented by design (specification phase - AGENTS.md section 1).
 * Owning task: T-MEM-004 - requirements, ADR, design, and tests are listed there.
 */
export async function removeMemberAction(
  _input: { readonly memberId: string },
): Promise<OperationResult<{ readonly removed: true }>> {
  throw new Error('Not implemented: T-MEM-004');
}
