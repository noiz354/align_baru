/**
 * Session service — real implementation.
 *
 * Requirements:
 * - FR-MATCH-002 (one active session per participant)
 * - FR-CHAT-009 (leave in one action)
 * - NFR-SAFE-004 (exit always possible)
 * - T-SESSION-003, T-SESSION-END-013, T-SESSION-004
 */

import type { ChatSession } from '../../domain/session/session';
import { sessionStore, claimStore, messageBuffer } from '../../server/db/in-memory';
import { transitionSession } from '../../domain/session/session';
import type { SessionEndReason } from '../../shared/contracts/signaling';

export interface EndSessionInput {
  sessionId: string;
  reason: SessionEndReason;
  participantId: string;
}

export interface SessionService {
  getSession(sessionId: string, participantId: string): Promise<ChatSession | null>;
  endSession(input: EndSessionInput): Promise<ChatSession>;
  getActiveForParticipant(participantId: string): Promise<ChatSession | null>;
}

export const createSessionService = (): SessionService => ({
  async getSession(sessionId: string, participantId: string): Promise<ChatSession | null> {
    const s = sessionStore.get(sessionId);
    if (!s) return null;
    // Authorization: caller must be participant
    if (s.participantAId !== participantId && s.participantBId !== participantId) {
      return null;
    }
    return s;
  },

  async getActiveForParticipant(participantId: string): Promise<ChatSession | null> {
    return sessionStore.getActiveForParticipant(participantId);
  },

  async endSession(input: EndSessionInput): Promise<ChatSession> {
    const s = sessionStore.get(input.sessionId);
    if (!s) throw new Error('Session not found');

    // Authorization: must be participant
    if (s.participantAId !== input.participantId && s.participantBId !== input.participantId) {
      throw new Error('FORBIDDEN: not participant');
    }

    // Idempotency: if already terminal, return existing
    const terminal = ['ENDED', 'REPORTED', 'BLOCKED', 'FAILED'];
    if (terminal.includes(s.status)) {
      return s;
    }

    // Determine target terminal status based on reason
    let targetStatus: ChatSession['status'] = 'ENDED';
    if (input.reason === 'report') targetStatus = 'REPORTED';
    else if (input.reason === 'block') targetStatus = 'BLOCKED';
    else if (input.reason === 'failed' || input.reason === 'transport-lost' || input.reason === 'server-restart') targetStatus = 'FAILED';

    // Transition through ENDING if ACTIVE/MATCHED/CONNECTING
    let current = s;
    if (['MATCHED', 'CONNECTING', 'ACTIVE'].includes(current.status) && targetStatus === 'ENDED') {
      // ACTIVE -> ENDING -> ENDED
      try {
        const ending = transitionSession(current, 'ENDING', input.reason);
        sessionStore.updateStatus(ending.id, 'ENDING', input.reason);
        current = ending;
      } catch {
        // if transition not allowed, proceed to terminal directly
      }
    }

    // Final transition
    const transitioned = transitionSession(current, targetStatus, input.reason);
    const updated = sessionStore.updateStatus(transitioned.id, targetStatus, input.reason as any);

    // Cleanup message buffer and claims
    messageBuffer.clearSession(updated.id);
    claimStore.release(`session:${updated.participantAId}`, updated.id);
    claimStore.release(`session:${updated.participantBId}`, updated.id);

    return updated;
  },
});

export const createNotImplementedSessionService = createSessionService;
