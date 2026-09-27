/**
 * Match request and eligibility types — real implementation.
 */

import type { ChatMode } from '../../shared/contracts/signaling';

export interface MatchRequest {
  participantId: string;
  mode: ChatMode;
  interestIds: string[];
  language: string | null;
  regionConstraint: string | null;
  joinedAt: Date;
}

export interface MatchResult {
  matched: boolean;
  sessionId: string | null;
  participantAId: string | null;
  participantBId: string | null;
  mode: ChatMode | null;
  interestOverlap: number;
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

export interface SafetyConstraints {
  hasBlock: boolean;
  hasActiveBan: boolean;
  hasActiveSession: boolean;
  hasLeftQueue: boolean;
  isRecentPeer: boolean;
  inCooldown: boolean;
}

export function areModesCompatible(a: ChatMode, b: ChatMode): boolean {
  return a === b;
}

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

export interface ClaimPrimitive {
  tryClaim(key: string, ownerId: string): Promise<boolean>;
  release(key: string, ownerId: string): Promise<void>;
  isHeld(key: string): Promise<boolean>;
}

export const createClaimPrimitive = (store: {
  tryClaim(key: string, ownerId: string): boolean;
  release(key: string, ownerId: string): void;
  isHeld(key: string): boolean;
}): ClaimPrimitive => ({
  async tryClaim(key: string, ownerId: string): Promise<boolean> {
    return store.tryClaim(key, ownerId);
  },
  async release(key: string, ownerId: string): Promise<void> {
    store.release(key, ownerId);
  },
  async isHeld(key: string): Promise<boolean> {
    return store.isHeld(key);
  },
});

export interface MatchmakingPort {
  findMatch(request: MatchRequest): Promise<MatchResult>;
}
