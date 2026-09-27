/**
 * Matchmaking service — real implementation.
 *
 * Requirements:
 * - FR-MATCH-001 … FR-MATCH-012
 * - T-MATCH-021, T-MATCH-022, T-MATCH-031
 * - INV-1, INV-2, INV-5, INV-6
 * - Races R1,R2,R9,R10,R11
 *
 * ADR: ADR-008, ADR-009, ADR-012
 */

import type { MatchRequest, MatchResult } from '../../domain/matchmaking/match-request';
import { areModesCompatible } from '../../domain/matchmaking/match-request';
import { queueStore, sessionStore, claimStore, blockStore, banStore, recentPeerStore, rateLimitStore, safetyEventStore } from '../../server/db/in-memory';
import { INTEREST_PREFERENCE_WINDOW_MS, LANGUAGE_PREFERENCE_WINDOW_MS } from '../../domain/matchmaking/queue-ticket';

export interface MatchmakingService {
  findMatch(request: MatchRequest): Promise<MatchResult>;
}

export interface CandidateConstraintService {
  evaluateConstraints(request: MatchRequest, candidate: MatchRequest): Promise<boolean>;
}

export interface PreferenceService {
  preferenceWindowRemaining(joinedAt: Date, now: Date): number;
}

function interestOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter(x => setB.has(x)).length;
}

export const createMatchmakingService = (): MatchmakingService => ({
  async findMatch(request: MatchRequest): Promise<MatchResult> {
    // Ban check fails closed (ADR-012)
    if (banStore.isBanned(request.participantId)) {
      return {
        matched: false,
        sessionId: null,
        participantAId: null,
        participantBId: null,
        mode: null,
        interestOverlap: 0,
        reasonClass: 'participant-banned',
      };
    }

    // Cooldown check
    if (rateLimitStore.cooldownRemaining(request.participantId) > 0) {
      return {
        matched: false,
        sessionId: null,
        participantAId: null,
        participantBId: null,
        mode: null,
        interestOverlap: 0,
        reasonClass: 'cooldown',
      };
    }

    // One active session invariant (INV-1)
    if (sessionStore.hasActive(request.participantId)) {
      return {
        matched: false,
        sessionId: null,
        participantAId: null,
        participantBId: null,
        mode: null,
        interestOverlap: 0,
        reasonClass: 'claim-contested',
      };
    }

    // Get candidates for mode
    const candidates = queueStore.candidatesFor(request.mode, request.participantId);
    if (candidates.length === 0) {
      return {
        matched: false,
        sessionId: null,
        participantAId: null,
        participantBId: null,
        mode: null,
        interestOverlap: 0,
        reasonClass: 'no-candidate',
      };
    }

    // Preference window logic (T-MATCH-031)
    const now = Date.now();
    const joinedAtMs = request.joinedAt.getTime();
    const withinInterestWindow = now - joinedAtMs < INTEREST_PREFERENCE_WINDOW_MS;
    const withinLanguageWindow = now - joinedAtMs < LANGUAGE_PREFERENCE_WINDOW_MS;

    // Sort candidates: prefer interest overlap if within window, else FIFO
    let sorted = candidates.slice().sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

    if (withinInterestWindow && request.interestIds.length > 0) {
      sorted = sorted.sort((a, b) => {
        const overlapA = interestOverlap(request.interestIds, a.interestIds);
        const overlapB = interestOverlap(request.interestIds, b.interestIds);
        if (overlapB !== overlapA) return overlapB - overlapA;
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      });
    } else if (withinLanguageWindow && request.language) {
      sorted = sorted.sort((a, b) => {
        const langMatchA = a.language === request.language ? 1 : 0;
        const langMatchB = b.language === request.language ? 1 : 0;
        if (langMatchB !== langMatchA) return langMatchB - langMatchA;
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      });
    }

    // Try each candidate with safety constraints evaluated at selection time (ADR-008 MR-3)
    for (const candidate of sorted) {
      // SC-4 mode compatibility
      if (!areModesCompatible(request.mode, candidate.mode)) continue;

      // SC-5 has left queue — check if candidate still waiting
      if (!queueStore.get(candidate.participantId)) continue;

      // SC-2 ban check for candidate (fail closed)
      if (banStore.isBanned(candidate.participantId)) {
        // Remove banned candidate from queue
        queueStore.leave(candidate.participantId);
        continue;
      }

      // SC-3 active session check for candidate
      if (sessionStore.hasActive(candidate.participantId)) continue;

      // SC-1 block check
      if (blockStore.isBlocked(request.participantId, candidate.participantId)) continue;

      // SC-6 recent peer avoidance
      if (recentPeerStore.isRecent(request.participantId, candidate.participantId)) continue;

      // SC-7 cooldown check for candidate
      if (rateLimitStore.cooldownRemaining(candidate.participantId) > 0) continue;

      // R1: single-flight claim — atomic session creation
      const claimKeyA = `participant:${request.participantId}`;
      const claimKeyB = `participant:${candidate.participantId}`;

      // Try claim both participants
      const claimedA = claimStore.tryClaim(claimKeyA, `match:${request.participantId}:${candidate.participantId}`);
      if (!claimedA) {
        return {
          matched: false,
          sessionId: null,
          participantAId: null,
          participantBId: null,
          mode: null,
          interestOverlap: 0,
          reasonClass: 'claim-contested',
        };
      }

      const claimedB = claimStore.tryClaim(claimKeyB, `match:${request.participantId}:${candidate.participantId}`);
      if (!claimedB) {
        // Release A, candidate already claimed by another worker (R1)
        claimStore.release(claimKeyA, `match:${request.participantId}:${candidate.participantId}`);
        continue; // try next candidate
      }

      // Re-check after claim (R2, R9) — participant may have left queue while we claimed
      if (!queueStore.get(request.participantId) || !queueStore.get(candidate.participantId)) {
        claimStore.release(claimKeyA, `match:${request.participantId}:${candidate.participantId}`);
        claimStore.release(claimKeyB, `match:${request.participantId}:${candidate.participantId}`);
        continue;
      }

      // Atomic session creation — both peers or neither (FR-MATCH-010)
      try {
        const session = sessionStore.create(
          request.participantId,
          candidate.participantId,
          request.mode,
          candidate.ticketId,
        );

        // Mark queue entries as matched
        queueStore.markMatched(request.participantId);
        queueStore.markMatched(candidate.participantId);

        // Record recent peers
        recentPeerStore.add(request.participantId, candidate.participantId);

        // Release claims — now held via active session index
        claimStore.release(claimKeyA, `match:${request.participantId}:${candidate.participantId}`);
        claimStore.release(claimKeyB, `match:${request.participantId}:${candidate.participantId}`);

        // Also set session claim for supersession handling
        claimStore.tryClaim(`session:${request.participantId}`, session.id);
        claimStore.tryClaim(`session:${candidate.participantId}`, session.id);

        const overlap = interestOverlap(request.interestIds, candidate.interestIds);

        return {
          matched: true,
          sessionId: session.id,
          participantAId: session.participantAId,
          participantBId: session.participantBId,
          mode: session.mode,
          interestOverlap: overlap,
          reasonClass: null,
        };
      } catch (e) {
        // INV-1 or other failure — release claims and try next
        claimStore.release(claimKeyA, `match:${request.participantId}:${candidate.participantId}`);
        claimStore.release(claimKeyB, `match:${request.participantId}:${candidate.participantId}`);
        continue;
      }
    }

    // No eligible candidate found
    return {
      matched: false,
      sessionId: null,
      participantAId: null,
      participantBId: null,
      mode: null,
      interestOverlap: 0,
      reasonClass: 'candidate-ineligible',
    };
  },
});

export const createCandidateConstraintService = (): CandidateConstraintService => ({
  async evaluateConstraints(request: MatchRequest, candidate: MatchRequest): Promise<boolean> {
    // Evaluate SC-1 … SC-7 at selection time, never from join-time snapshot
    if (blockStore.isBlocked(request.participantId, candidate.participantId)) return false;
    if (banStore.isBanned(request.participantId) || banStore.isBanned(candidate.participantId)) return false;
    if (sessionStore.hasActive(request.participantId) || sessionStore.hasActive(candidate.participantId)) return false;
    if (!queueStore.get(request.participantId) || !queueStore.get(candidate.participantId)) return false;
    if (recentPeerStore.isRecent(request.participantId, candidate.participantId)) return false;
    if (rateLimitStore.cooldownRemaining(request.participantId) > 0 || rateLimitStore.cooldownRemaining(candidate.participantId) > 0) return false;
    if (!areModesCompatible(request.mode, candidate.mode)) return false;
    return true;
  },
});

export const createPreferenceService = (): PreferenceService => ({
  preferenceWindowRemaining(joinedAt: Date, now: Date): number {
    const elapsed = now.getTime() - joinedAt.getTime();
    const remaining = INTEREST_PREFERENCE_WINDOW_MS - elapsed;
    return remaining > 0 ? remaining : 0;
  },
});
