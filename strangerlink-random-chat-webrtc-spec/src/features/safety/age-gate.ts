/**
 * Age gate and consent enforcement — real implementation.
 *
 * Requirements:
 * - FR-ENTRY-001 … FR-ENTRY-010
 * - T-SESSION-002
 *
 * ADR: ADR-014
 * See: docs/safety/AGE-GATING.md, SAFETY.md §2, §3
 */

import type { ConsentRecord } from '../../domain/participant/participant';
import { isConsentCurrent, isConsentSufficientForMedia } from '../../domain/participant/participant';
import { safetyEventStore } from '../../server/db/in-memory';

export interface AgeGateState {
  attestedAge: boolean;
  acknowledgedRisks: boolean;
  canContinue: boolean;
}

export const INITIAL_AGE_GATE_STATE: AgeGateState = {
  attestedAge: false,
  acknowledgedRisks: false,
  canContinue: false,
};

export function evaluateAgeGate(state: AgeGateState): AgeGateState {
  return {
    ...state,
    canContinue: state.attestedAge && state.acknowledgedRisks,
  };
}

export const CURRENT_CONSENT_VERSION = 1;

export interface AgeGateService {
  assertChatEligible(consent: ConsentRecord | null, serverVersion: number): void;
  assertMediaEligible(consent: ConsentRecord | null, serverVersion: number): void;
  recordAttestation(participantId: string, consent: ConsentRecord): Promise<void>;
}

export class ConsentRequiredError extends Error {
  constructor(msg = 'Consent required') {
    super(msg);
    this.name = 'ConsentRequiredError';
  }
}

export class ConsentVersionMismatchError extends Error {
  constructor(msg = 'Consent version mismatch') {
    super(msg);
    this.name = 'ConsentVersionMismatchError';
  }
}

export const createAgeGateService = (): AgeGateService => ({
  assertChatEligible(consent: ConsentRecord | null, serverVersion: number): void {
    if (!consent) throw new ConsentRequiredError('Age gate not passed');
    if (!isConsentCurrent(consent, serverVersion)) {
      throw new ConsentVersionMismatchError('Consent stale or incomplete');
    }
  },
  assertMediaEligible(consent: ConsentRecord | null, serverVersion: number): void {
    if (!consent) throw new ConsentRequiredError('Age gate not passed');
    if (!isConsentSufficientForMedia(consent, serverVersion)) {
      throw new ConsentRequiredError('Media consent requires IP-exposure acknowledgement');
    }
  },
  async recordAttestation(participantId: string, consent: ConsentRecord): Promise<void> {
    // Record as safety event, no DOB, no personal data
    safetyEventStore.record('age-attested', participantId, null, {
      consentVersion: consent.consentVersion,
      ageAttested: consent.ageAttested ? 1 : 0,
    });
    safetyEventStore.record('consent-accepted', participantId, null, {
      consentVersion: consent.consentVersion,
    });
  },
});

export const createNotImplementedAgeGateService = createAgeGateService;

export const SAFETY_NOTICE_STATEMENTS = [
  'You will be connected with random strangers.',
  'Conversations are not screened in real time. You may encounter offensive content.',
  'Conversations are not recorded or stored.',
  'You can leave at any time, and report or block the other person at any time.',
  'During an audio or video call, the other person may be able to determine your approximate location from your internet connection. If that matters to you, use text chat.',
] as const;
