/**
 * Session service port.
 *
 * Requirements:
 * - FR-MATCH-002 (one active session per participant)
 * - FR-CHAT-009 (leave in one action)
 * - NFR-SAFE-004 (exit always possible)
 *
 * ADR:
 * - ADR-007 (session model)
 *
 * See:
 * - STATE_MACHINE.md
 * - DOMAIN.md §2.4
 *
 * SERVICE PORT ONLY. No session lifecycle logic exists in this phase.
 */

import type { ChatSession } from '../../domain/session/session';

export interface EndSessionInput {
  sessionId: string;
  reason: 'skip' | 'leave' | 'report' | 'block' | 'timeout';
  participantId: string;
}

export interface SessionService {
  getSession(sessionId: string, participantId: string): Promise<ChatSession | null>;
  endSession(input: EndSessionInput): Promise<ChatSession>;
}

/**
 * T-SESSION-003 — Enforce the one-active-session invariant.
 *
 * T-SESSION-END-013 — Skip, leave, and exit.
 *
 * Throws until implemented. When implemented it must:
 * - enforce INV-1 through a single primitive, not scattered checks
 * - handle two browser tabs for one identity (R8)
 * - handle a reconnect that supersedes an older socket (R12)
 * - allow leaving in ONE action from CREATED, WAITING, MATCHED, CONNECTING,
 *   and ACTIVE — with no confirmation modal intercepting a deliberate exit
 */
export const createNotImplementedSessionService = (): SessionService => ({
  async getSession(
    _sessionId: string,
    _participantId: string,
  ): Promise<ChatSession | null> {
    throw new Error('Not implemented: T-SESSION-004');
  },
  async endSession(_input: EndSessionInput): Promise<ChatSession> {
    throw new Error('Not implemented: T-SESSION-END-013');
  },
});
