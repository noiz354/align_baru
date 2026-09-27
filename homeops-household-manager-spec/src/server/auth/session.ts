// HomeOps - server skeleton (specification phase). Session contract only.

/**
 * Database-authoritative sessions (ADR-004, SELECTED: Better Auth).
 * Deleting a session row logs the user out immediately everywhere - no token outlives its row,
 * which is what makes member removal, lost devices, and "sign out all devices" honest (I-MEM-003).
 *
 * Status: unimplemented by design. Owning tasks: T-AUTH-001, T-AUTH-002, T-AUTH-004.
 */
export type SessionInfo = {
  readonly sessionId: string;
  readonly userId: string;
  readonly expiresAt: string;
  readonly deviceLabel?: string;
};

export async function createSession(_input: {
  readonly userId: string;
  readonly ttlHours: number;
}): Promise<SessionInfo> {
  throw new Error('Not implemented: T-AUTH-001');
}

export async function revokeSession(_input: { readonly sessionId: string }): Promise<void> {
  throw new Error('Not implemented: T-AUTH-004');
}

export async function revokeAllSessions(_input: {
  readonly userId: string;
}): Promise<{ readonly revoked: number }> {
  throw new Error('Not implemented: T-AUTH-004');
}
