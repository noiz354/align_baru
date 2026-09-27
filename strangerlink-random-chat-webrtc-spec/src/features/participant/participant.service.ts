/**
 * Participant service — real implementation.
 *
 * Requirements:
 * - FR-ENTRY-004 (pseudonymous, no personal data)
 * - NFR-PRIV-001, NFR-PRIV-002
 * - T-SESSION-001
 *
 * ADR: ADR-007, ADR-014
 */

import type { Participant } from '../../domain/participant/participant';
import { participantStore } from '../../server/db/in-memory';
import { generateId } from '../../shared/utils/id';

export interface ParticipantService {
  createParticipant(consentVersion: number): Promise<Participant>;
  getParticipant(participantId: string): Promise<Participant | null>;
}

export const createParticipantService = (): ParticipantService => ({
  async createParticipant(_consentVersion: number): Promise<Participant> {
    // No personal data accepted — only server-generated uuidv7
    // consentVersion is recorded as safety event elsewhere, not as PII
    const p = participantStore.create();
    return p;
  },
  async getParticipant(participantId: string): Promise<Participant | null> {
    return participantStore.get(participantId);
  },
});

// Legacy factory name for compatibility with skeleton
export const createNotImplementedParticipantService = createParticipantService;

// Additional domain service with restriction/ban marking
export const participantDomainService = {
  createParticipant(): Participant {
    return participantStore.create();
  },
  get(participantId: string): Participant | null {
    return participantStore.get(participantId);
  },
  markRestricted(participantId: string): void {
    participantStore.setStatus(participantId, 'RESTRICTED');
  },
  markBanned(participantId: string): void {
    participantStore.setStatus(participantId, 'BANNED');
  },
};
