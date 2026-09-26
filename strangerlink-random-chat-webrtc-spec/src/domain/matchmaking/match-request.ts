/**
 * Match request and eligibility types.
 *
 * Requirements:
 * - FR-MATCH-001 … FR-MATCH-012
 * - NFR-SAFE-004 (ban checks fail closed)
 *
 * ADR:
 * - ADR-008 (matchmaking model)
 * - ADR-009 (interest matching)
 * - ADR-012 (ban enforcement)
 *
 * See:
 * - MATCHMAKING.md
 * - SAFETY.md §6, §7
 */

import type { ChatMode } from '../../shared/contracts/signaling';

/** A match request produced by the queue. */
export interface MatchRequest {
  participantId: string;
  mode: ChatMode;
  interestIds: string[];
  language: string | null;
  regionConstraint: string | null;
  joinedAt: Date;
}

/** The result of a match attempt. */
export interface MatchResult {
  matched: boolean;
  sessionId: string | null;
  participantAId: string | null;
  participantBId: string | null;
  mode: ChatMode | null;
  interestOverlap: number;
  /** Present when `matched` is false. */
  reasonClass: MatchFailureReason | null;
}

export type MatchFailureReason =
  | 'no-candidate'
  | 'candidate-ineligible'
  | 'claim-lost'
  | 'claim-contested'
  | 'participant-left'
  | 'participant-banned'
  | 'participant-restricted'
  | 'cooldown'
  | 'queue-full'
  | 'mode-disabled';

/**
 * Safety constraints SC-1 … SC-7 from MATCHMAKING.md §6.
 *
 * These are evaluated at CANDIDATE SELECTION, never from a join-time
 * snapshot (ADR-008 MR-3).
 */
export interface SafetyConstraints {
  /** SC-1 */
  hasBlock: boolean;
  /** SC-2 */
  hasActiveBan: boolean;
  /** SC-3 */
  hasActiveSession: boolean;
  /** SC-5 */
  hasLeftQueue: boolean;
  /** SC-6 */
  isRecentPeer: boolean;
  /** SC-7 */
  inCooldown: boolean;
}

/**
 * SC-4: mode compatibility. Text modes are compatible with each other only
 * when the media capability matches exactly (FR-MATCH-006).
 */
export function areModesCompatible(a: ChatMode, b: ChatMode): boolean {
  return a === b;
}

/**
 * Evaluate whether a candidate satisfies the safety constraints.
 *
 * A violated constraint rejects the candidate and scanning CONTINUES; it
 * does not abort the match attempt.
 */
export function isCandidateEligible(constraints: SafetyConstraints): boolean {
  return (
    !constraints.hasBlock &&
    !constraints.hasActiveBan &&
    !constraints.hasActiveSession &&
    !constraints.hasLeftQueue &&
    !constraints.isRecentPeer &&
    !constraints.inCooldown
  );
}

/**
 * The single-flight claim primitive.
 *
 * This is the mechanism behind INV-1 and the resolution for R1, R2, R9, and
 * R10. It MUST exist before matchmaking depends on it (VS-3, condition 2 of
 * docs/architecture/FINAL-REVIEW.md §4).
 *
 * T-MATCH-021
 */
export interface ClaimPrimitive {
  /** Returns true only for the winner. The loser gets a definitive negative. */
  tryClaim(key: string, ownerId: string): Promise<boolean>;
  release(key: string, ownerId: string): Promise<void>;
  isHeld(key: string): Promise<boolean>;
}

export const createNotImplementedClaimPrimitive = (): ClaimPrimitive => ({
  async tryClaim(_key: string, _ownerId: string): Promise<boolean> {
    throw new Error('Not implemented: T-MATCH-021');
  },
  async release(_key: string, _ownerId: string): Promise<void> {
    throw new Error('Not implemented: T-MATCH-021');
  },
  async isHeld(_key: string): Promise<boolean> {
    throw new Error('Not implemented: T-MATCH-021');
  },
});

/**
 * The matchmaking port.
 *
 * T-MATCH-021 / T-MATCH-022
 */
export interface MatchmakingPort {
  findMatch(request: MatchRequest): Promise<MatchResult>;
}

export const createNotImplementedMatchmakingPort = (): MatchmakingPort => ({
  async findMatch(_request: MatchRequest): Promise<MatchResult> {
    throw new Error('Not implemented: T-MATCH-021');
  },
});
