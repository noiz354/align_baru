/**
 * Authorization port.
 *
 * Requirements:
 * - NFR-SEC-001 (all authorization decisions are made server-side)
 * - NFR-SEC-008 (admin privilege escalation)
 *
 * ADR:
 * - ADR-001 (web framework — authorization never middleware-only)
 * - ADR-010 (moderation model)
 *
 * See:
 * - SECURITY.md §0, §12
 * - AGENTS.md §2
 *
 * PORT ONLY. No authentication, authorization, or session issuance exists in
 * this phase.
 *
 * CRITICAL (ADR-001 MR-2): authorization is re-checked server-side in every
 * handler, route, and server action. Middleware is NEVER the sole gate. The
 * Next.js May 2026 advisory class (middleware/proxy authorization bypass) is
 * the specific reason.
 */

/** Admin roles. Least privilege. */
export type AdminRole = 'moderator' | 'senior-moderator' | 'admin';

export interface AdminPrincipal {
  id: string;
  role: AdminRole;
  mfaVerified: boolean;
}

/** The capability required by an admin action. */
export type AdminCapability =
  | 'moderation.read'
  | 'moderation.action'
  | 'ban.issue'
  | 'ban.extend'
  | 'ban.revoke'
  | 'admin.manage-roles'
  | 'metrics.read';

/**
 * The capability-to-role map.
 *
 * NFR-SEC-008: no self-escalation. `admin.manage-roles` requires a different
 * actor, enforced by the moderation action layer.
 */
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

/**
 * Authorization port.
 *
 * T-SEC-071
 *
 * Throws until implemented. When implemented, every method must consult the
 * server on every call — never a cached decision from middleware.
 */
export interface AuthorizationPort {
  /** A session-scoped request: the caller must be a participant. */
  assertSessionParticipant(
    participantId: string,
    sessionId: string,
  ): Promise<void>;

  /** An admin request: the principal must hold the capability. */
  assertAdminCapability(
    principal: AdminPrincipal,
    capability: AdminCapability,
  ): Promise<void>;
}

export const createNotImplementedAuthorizationPort =
  (): AuthorizationPort => ({
    async assertSessionParticipant(
      _participantId: string,
      _sessionId: string,
    ): Promise<void> {
      throw new Error('Not implemented: T-SEC-071');
    },
    async assertAdminCapability(
      _principal: AdminPrincipal,
      _capability: AdminCapability,
    ): Promise<void> {
      throw new Error('Not implemented: T-SEC-071');
    },
  });
