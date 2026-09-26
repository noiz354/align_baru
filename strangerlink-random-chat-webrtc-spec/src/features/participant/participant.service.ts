/**
 * Participant service port.
 *
 * Requirements:
 * - FR-ENTRY-004
 * - NFR-PRIV-001, NFR-PRIV-002
 *
 * ADR:
 * - ADR-007 (session model)
 * - ADR-014 (anonymity model)
 *
 * See:
 * - DOMAIN.md §2.1
 * - PRIVACY.md §1, §2
 *
 * SERVICE PORT ONLY.
 *
 * A participant is created with NO credential and NO personal data. There
 * are no accounts, no profiles, and no login.
 */

import type { Participant } from '../../domain/participant/participant';

export interface ParticipantService {
  createParticipant(consentVersion: number): Promise<Participant>;
  getParticipant(participantId: string): Promise<Participant | null>;
}

/**
 * T-SESSION-001 — Create a pseudonymous participant identity.
 *
 * Throws until implemented. When implemented it must:
 * - accept no user-supplied personal information
 * - generate a uuidv7 server-side
 * - produce an identity that is not linkable to an account, device, or person
 * - degrade gracefully when browser storage is unavailable (EC-23)
 */
export const createNotImplementedParticipantService =
  (): ParticipantService => ({
    async createParticipant(_consentVersion: number): Promise<Participant> {
      throw new Error('Not implemented: T-SESSION-001');
    },
    async getParticipant(_participantId: string): Promise<Participant | null> {
      throw new Error('Not implemented: T-SESSION-001');
    },
  });
