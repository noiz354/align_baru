/**
 * Matchmaking service port.
 *
 * Requirements:
 * - FR-MATCH-001, FR-MATCH-003, FR-MATCH-004, FR-MATCH-009, FR-MATCH-010
 * - FR-MATCH-011 (never match banned participants)
 *
 * ADR:
 * - ADR-008 (matchmaking model)
 * - ADR-009 (interest matching)
 * - ADR-012 (ban enforcement)
 *
 * See:
 * - MATCHMAKING.md
 * - STATE_MACHINE.md §6 (races R1–R12)
 *
 * SERVICE PORT ONLY.
 *
 * NO REAL MATCHMAKING LOGIC EXISTS IN THIS PHASE. The first future vertical
 * slice (VS-3) is the first thing that will implement this, and it is NOT
 * implemented now.
 *
 * This file exists so that the eventual implementation has a declared
 * contract, a named task, and a list of races it must resolve.
 */

import type { MatchResult } from '../../domain/matchmaking/match-request';
import type { MatchRequest } from '../../domain/matchmaking/match-request';

/** Match two eligible participants. */
export interface MatchmakingService {
  /**
   * Select a candidate for `request` and create a session atomically.
   *
   * When implemented, this must resolve:
   * - R1  two workers matching the same participant
   * - R2  participant cancels while being matched
   * - R9  queue entry expires at the instant of matching
   * - R10 ban applied while the participant is waiting
   * - R11 both peers press Skip at once
   *
   * and enforce:
   * - eligibility at selection time, never from a join-time snapshot
   * - session creation is atomic: both peers or neither
   * - ban checks fail closed
   */
  findMatch(request: MatchRequest): Promise<MatchResult>;
}

/**
 * T-MATCH-021 — Match Two Eligible Participants.
 *
 * Throws until implemented.
 */
export const createMatchmakingService = (): MatchmakingService => ({
  async findMatch(_request: MatchRequest): Promise<MatchResult> {
    throw new Error('Not implemented: T-MATCH-021');
  },
});

/**
 * T-MATCH-022 — Candidate safety constraint evaluation.
 *
 * Applies blocks, bans, restrictions, recent peers, and mode compatibility
 * at candidate selection. See MATCHMAKING.md §6.
 */
export interface CandidateConstraintService {
  evaluateConstraints(
    request: MatchRequest,
    candidate: MatchRequest,
  ): Promise<boolean>;
}

export const createCandidateConstraintService =
  (): CandidateConstraintService => ({
    async evaluateConstraints(
      _request: MatchRequest,
      _candidate: MatchRequest,
    ): Promise<boolean> {
      throw new Error('Not implemented: T-MATCH-022');
    },
  });

/**
 * T-MATCH-031 — Interest and language preference.
 *
 * Preference, never a guarantee. Bounded window with fallback to the general
 * pool (ADR-009).
 */
export interface PreferenceService {
  /** Returns the bounded preference window remaining, in milliseconds. */
  preferenceWindowRemaining(joinedAt: Date, now: Date): number;
}

export const createPreferenceService = (): PreferenceService => ({
  preferenceWindowRemaining(joinedAt: Date, now: Date): number {
    throw new Error('Not implemented: T-MATCH-031');
  },
});
