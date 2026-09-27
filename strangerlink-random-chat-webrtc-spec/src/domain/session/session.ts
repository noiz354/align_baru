/**
 * ChatSession domain types and invariants — real implementation.
 *
 * Requirements:
 * - FR-MATCH-002 (one active session per participant)
 * - NFR-SEC-003 (unguessable identifiers)
 * - NFR-SAFE-004 (exit always possible)
 *
 * ADR: ADR-007
 * See: STATE_MACHINE.md, DATA_MODEL.md §3.3
 */

export type SessionStatus =
  | 'CREATED'
  | 'WAITING'
  | 'MATCHED'
  | 'CONNECTING'
  | 'ACTIVE'
  | 'ENDING'
  | 'ENDED'
  | 'REPORTED'
  | 'BLOCKED'
  | 'FAILED';

export const TERMINAL_SESSION_STATUSES: readonly SessionStatus[] = [
  'ENDED',
  'REPORTED',
  'BLOCKED',
  'FAILED',
];

export function isTerminal(status: SessionStatus): boolean {
  return TERMINAL_SESSION_STATUSES.includes(status);
}

export interface ChatSession {
  id: string;
  participantAId: string;
  participantBId: string;
  mode: import('../../shared/contracts/signaling').ChatMode;
  status: SessionStatus;
  createdAt: Date;
  endedAt: Date | null;
  endReason: import('../../shared/contracts/signaling').SessionEndReason | null;
  durationMs: number | null;
  queueTicketId: string | null;
}

export const INVARIANT_ONE_ACTIVE_SESSION =
  'A participant has at most one session in a non-terminal status.';
export const INVARIANT_TWO_DISTINCT_PARTICIPANTS =
  'A session has exactly two participants and they are distinct.';
export const INVARIANT_ONLY_DOCUMENTED_TRANSITIONS =
  'Only transitions documented in STATE_MACHINE.md are permitted.';
export const INVARIANT_TERMINAL_ABSORBING =
  'A terminal session cannot transition to any other state.';
export const INVARIANT_NO_BLOCKED_PAIR =
  'No session may exist between participants where a block is in force.';
export const INVARIANT_NO_BANNED_PARTICIPANT =
  'No session may exist for a participant with an active ban.';
export const INVARIANT_SERVER_GENERATED_IDS =
  'Session identifiers are generated server-side and are never accepted from a client.';
export const INVARIANT_REPORT_ON_TERMINAL_SESSION =
  'A report may reference a session in any status, including terminal.';

export const SESSION_TRANSITIONS: Readonly<
  Record<SessionStatus, readonly SessionStatus[]>
> = {
  CREATED: ['WAITING'],
  WAITING: ['MATCHED', 'FAILED'],
  MATCHED: ['CONNECTING', 'ACTIVE', 'ENDING', 'FAILED'],
  CONNECTING: ['ACTIVE', 'ENDING', 'FAILED'],
  ACTIVE: ['ENDING', 'REPORTED', 'BLOCKED', 'FAILED'],
  ENDING: ['ENDED', 'FAILED'],
  ENDED: [],
  REPORTED: [],
  BLOCKED: [],
  FAILED: [],
};

export interface TransitionGuardContext {
  hasActiveBan: boolean;
  hasBlock: boolean;
  isEligible: boolean;
  mode: string;
}

export function isTransitionPermitted(
  from: SessionStatus,
  to: SessionStatus,
  context: TransitionGuardContext,
): boolean {
  const allowed = SESSION_TRANSITIONS[from];
  if (!allowed || !(allowed as readonly string[]).includes(to)) {
    return false;
  }
  // Additional guards
  if (context.hasActiveBan) return false;
  if (context.hasBlock && to === 'MATCHED') return false;
  return true;
}

/**
 * Real transition function.
 * T-SESSION-004
 */
export function transitionSession(
  session: ChatSession,
  to: SessionStatus,
  reason: string,
): ChatSession {
  // INV-4
  if (isTerminal(session.status)) {
    throw new Error(`INV-4: terminal ${session.status} cannot transition to ${to}`);
  }
  const allowed = SESSION_TRANSITIONS[session.status];
  if (!allowed || !(allowed as readonly string[]).includes(to)) {
    throw new Error(`INV-3: transition ${session.status} -> ${to} not documented`);
  }
  const now = new Date();
  const next: ChatSession = {
    ...session,
    status: to,
    endReason: (to === 'ENDED' || to === 'FAILED' || to === 'REPORTED' || to === 'BLOCKED') ? (reason as any) : session.endReason,
    endedAt: isTerminal(to) ? now : session.endedAt,
    durationMs: isTerminal(to) ? now.getTime() - session.createdAt.getTime() : session.durationMs,
  };
  return next;
}
