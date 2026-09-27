/**
 * Blocks service — real implementation.
 *
 * Requirements:
 * - FR-BLOCK-001 … FR-BLOCK-006
 * - T-BLOCK-017
 * - R5 (block created while requeue in flight)
 * - ADR-011, docs/safety/BLOCKING.md
 */

import { blockStore, sessionStore, safetyEventStore } from '../../server/db/in-memory';

export interface CreateBlockInput {
  sessionId: string;
  scope: 'session' | 'platform';
}

export interface BlocksService {
  createBlock(
    blockerIdentityId: string,
    input: CreateBlockInput,
  ): Promise<{ blockId: string }>;
  isBlocked(blockerIdentityId: string, blockedIdentityId: string): Promise<boolean>;
}

export const createBlocksService = (): BlocksService => ({
  async createBlock(
    blockerIdentityId: string,
    input: CreateBlockInput,
  ): Promise<{ blockId: string }> {
    const session = sessionStore.get(input.sessionId);
    if (!session) throw new Error('NOT_FOUND: session not found');

    // Authorization: blocker must be participant
    if (session.participantAId !== blockerIdentityId && session.participantBId !== blockerIdentityId) {
      throw new Error('FORBIDDEN: not participant');
    }

    const blockedId = session.participantAId === blockerIdentityId ? session.participantBId : session.participantAId;

    // Idempotent — if already blocked, return existing
    if (blockStore.isBlockedDirectional(blockerIdentityId, blockedId)) {
      const existing = blockStore.all().find(b => b.blockerId === blockerIdentityId && b.blockedId === blockedId);
      if (existing) return { blockId: existing.id };
    }

    const block = blockStore.create(blockerIdentityId, blockedId, input.scope);

    safetyEventStore.record('session-terminated', blockerIdentityId, input.sessionId, {
      reason: 'block',
      scope: input.scope,
    });

    return { blockId: block.id };
  },

  async isBlocked(blockerIdentityId: string, blockedIdentityId: string): Promise<boolean> {
    return blockStore.isBlocked(blockerIdentityId, blockedIdentityId);
  },
});
