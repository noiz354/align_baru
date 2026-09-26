/**
 * ChatSession domain types and invariants.
 *
 * Requirements:
 * - FR-MATCH-002 (one active session per participant)
 * - NFR-SEC-003 (unguessable identifiers)
 * - NFR-SAFE-004 (exit always possible)
 *
 * ADR:
 * - ADR-007 (session model)
 *
 * See:
 * - STATE_MACHINE.md
 * - DATA_MODEL.md §3.3
 */

/**
 * The session state machine. See STATE_MACHINE.md §2.
 *
 * Note: CANCELLED is a QUEUE state, not a session state. A participant who
 * cancels while WAITING never creates a session.
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

/** Terminal statuses. INV-4: terminal states are absorbing. */
export const TERMINAL_SESSION_STATUSES: readonly SessionStatus[] = [
  'ENDED',
  'REPORTED',
  'BLOCKED',
  'FAILED',
];

export function isTerminal(status: SessionStatus): boolean {
  return TERMINAL_SESSION_STATUSES.includes(status);
}

/**
 * The authoritative session record.
 *
 * DELIBERATELY ABSENT (DATA_MODEL.md §3.3):
 * - any message or transcript reference
 * - any media reference
 * - any SDP or ICE field
 * - any name, email, phone, or location
 *
 * A foreign key to a message table would make Tier 0 retention impossible.
 */
export interface ChatSession {
  /** Server-generated uuidv7. Never accepted from a client (INV-7). */
  id: string;
  participantAId: string;
  participantBId: string;
  mode: import('../shared/contracts/signaling').ChatMode;
  status: SessionStatus;
  createdAt: Date;
  endedAt: Date | null;
  endReason: import('../shared/contracts/signaling').SessionEndReason | null;
  durationMs: number | null;
  queueTicketId: string | null;
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

/**
 * INV-1: a participant has at most one session in a non-terminal status.
 *
 * Enforced by a single-flight claim primitive (primary), a partial unique
 * index in PostgreSQL (secondary), and a paging metric (detection).
 * See RUNBOOK RB-02.
 */
export const INVARIANT_ONE_ACTIVE_SESSION =
  'A participant has at most one session in a non-terminal status.';

/**
 * INV-2: a session has exactly two distinct participants.
 */
export const INVARIANT_TWO_DISTINCT_PARTICIPANTS =
  'A session has exactly two participants and they are distinct.';

/**
 * INV-3: only documented transitions are permitted.
 * See STATE_MACHINE.md §3.
 */
export const INVARIANT_ONLY_DOCUMENTED_TRANSITIONS =
  'Only transitions documented in STATE_MACHINE.md are permitted.';

/**
 * INV-4: terminal states are absorbing.
 */
export const INVARIANT_TERMINAL_ABSORBING =
  'A terminal session cannot transition to any other state.';

/**
 * INV-5: no session may exist between blocked participants.
 * See ADR-011.
 */
export const INVARIANT_NO_BLOCKED_PAIR =
  'No session may exist between participants where a block is in force.';

/**
 * INV-6: no session may exist for a banned participant.
 * See ADR-012.
 */
export const INVARIANT_NO_BANNED_PARTICIPANT =
  'No session may exist for a participant with an active ban.';

/**
 * INV-7: session identifiers are server-generated only.
 */
export const INVARIANT_SERVER_GENERATED_IDS =
  'Session identifiers are generated server-side and are never accepted from a client.';

/**
 * INV-8: a report may reference a terminal session.
 * See ADR-011 MR-1.
 */
export const INVARIANT_REPORT_ON_TERMINAL_SESSION =
  'A report may reference a session in any status, including terminal.';

// ---------------------------------------------------------------------------
// Transition table
// ---------------------------------------------------------------------------

/**
 * Documented transitions. INV-3 is enforced against this table.
 *
 * The transition function throws until implemented. See STATE_MACHINE.md §3
 * for the full trigger and guard detail.
 */
export const SESSION_TRANSITIONS: Readonly<
  Record<SessionStatus, readonly SessionStatus[]>
> = {
  CREATED: ['WAITING'],
  WAITING: ['MATCHED', 'CANCELLED_QUEUE', 'FAILED'],
  MATCHED: ['CONNECTING', 'ACTIVE', 'ENDING', 'FAILED'],
  CONNECTING: ['ACTIVE', 'ENDING', 'FAILED'],
  ACTIVE: ['ENDING', 'REPORTED', 'BLOCKED', 'FAILED'],
  ENDING: ['ENDED'],
  ENDED: [],
  REPORTED: [],
  BLOCKED: [],
  FAILED: [],
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export interface TransitionGuardContext {
  hasActiveBan: boolean;
  hasBlock: boolean;
  isEligible: boolean;
  mode: string;
}

/**
 * Evaluate whether a transition is permitted.
 *
 * The guard layer is intentionally separate from the transition table so that
 * race handling (R1–R12) has one place to live.
 */
export function isTransitionPermitted(
  from: SessionStatus,
  to: SessionStatus,
  _context: TransitionGuardContext,
): boolean {
  const allowed = SESSION_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    return false;
  }
  // Guards are evaluated at selection time, never from a join-time snapshot.
  // See ADR-008 MR-3.
  return true;
}

/**
 * The session transition function.
 *
 * T-SESSION-004
 *
 * Throws until implemented. Every transition must emit its documented event
 * and resolve the races in STATE_MACHINE.md §6.
 */
export function transitionSession(
  _session: ChatSession,
  _to: SessionStatus,
  _reason: string,
): ChatSession {
  throw new Error('Not implemented: T-SESSION-004');
}
