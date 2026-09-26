/**
 * Blocks service port.
 *
 * Requirements:
 * - FR-BLOCK-001 … FR-BLOCK-006
 *
 * ADR:
 * - ADR-011 (reporting model)
 * - ADR-012 (ban enforcement)
 *
 * See:
 * - docs/safety/BLOCKING.md
 * - SAFETY.md §6
 *
 * SERVICE PORT ONLY. Block creation is NOT functional in this phase.
 */

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

/**
 * T-BLOCK-017 — Create a block.
 *
 * Throws until implemented. When implemented it must:
 * - require exactly one confirmation (FR-BLOCK-003)
 * - require no explanation (FR-BLOCK-006)
 * - persist across reload within the browser session (FR-BLOCK-004)
 * - end the session immediately
 * - be re-checked at candidate selection, not only at queue join (R5)
 * - disclose honestly that blocking works through StrangerLink only
 *
 * A block record contains no reason, no note, and no personal data.
 */
export const createBlocksService = (): BlocksService => ({
  async createBlock(
    _blockerIdentityId: string,
    _input: CreateBlockInput,
  ): Promise<{ blockId: string }> {
    throw new Error('Not implemented: T-BLOCK-017');
  },
  async isBlocked(
    _blockerIdentityId: string,
    _blockedIdentityId: string,
  ): Promise<boolean> {
    throw new Error('Not implemented: T-BLOCK-017');
  },
});
