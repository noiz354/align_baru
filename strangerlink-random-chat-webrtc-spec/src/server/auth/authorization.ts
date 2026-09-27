/**
 * Authorization — real implementation.
 *
 * Requirements:
 * - NFR-SEC-001 (server-side authz)
 * - NFR-SEC-008 (admin privilege escalation)
 * - T-SEC-071
 * - ADR-001, ADR-010
 */

import { sessionStore } from '../db/in-memory';

export type AdminRole = 'moderator' | 'senior-moderator' | 'admin';

export interface AdminPrincipal {
  id: string;
  role: AdminRole;
  mfaVerified: boolean;
}

export type AdminCapability =
  | 'moderation.read'
  | 'moderation.action'
  | 'ban.issue'
  | 'ban.extend'
  | 'ban.revoke'
  | 'admin.manage-roles'
  | 'metrics.read';

export const ROLE_CAPABILITIES: Readonly<Record<AdminRole, readonly AdminCapability[]>> = {
  moderator: ['moderation.read', 'moderation.action'],
  'senior-moderator': [
    'moderation.read',
    'moderation.action',
    'ban.issue',
    'ban.extend',
    'ban.revoke',
  ],
  admin: [
    'moderation.read',
    'moderation.action',
    'ban.issue',
    'ban.extend',
    'ban.revoke',
    'admin.manage-roles',
    'metrics.read',
  ],
};

export interface AuthorizationPort {
  assertSessionParticipant(
    participantId: string,
    sessionId: string,
  ): Promise<void>;

  assertAdminCapability(
    principal: AdminPrincipal,
    capability: AdminCapability,
  ): Promise<void>;
}

export const createAuthorizationPort = (): AuthorizationPort => ({
  async assertSessionParticipant(participantId: string, sessionId: string): Promise<void> {
    // Server-side re-check on every request (ADR-001 MR-2)
    const session = sessionStore.get(sessionId);
    if (!session) throw new Error('NOT_FOUND: session not found');
    if (session.participantAId !== participantId && session.participantBId !== participantId) {
      throw new Error('FORBIDDEN: not participant of session');
    }
  },

  async assertAdminCapability(principal: AdminPrincipal, capability: AdminCapability): Promise<void> {
    // No self-escalation, MFA for enforcement roles
    const caps = ROLE_CAPABILITIES[principal.role] ?? [];
    if (!(caps as readonly string[]).includes(capability)) {
      throw new Error(`FORBIDDEN: role ${principal.role} lacks ${capability}`);
    }
    // MFA required for ban and admin actions
    const mfaRequired: AdminCapability[] = ['ban.issue', 'ban.extend', 'ban.revoke', 'admin.manage-roles', 'moderation.action'];
    if (mfaRequired.includes(capability) && !principal.mfaVerified) {
      throw new Error('FORBIDDEN: MFA required');
    }
  },
});

export const createNotImplementedAuthorizationPort = createAuthorizationPort;
