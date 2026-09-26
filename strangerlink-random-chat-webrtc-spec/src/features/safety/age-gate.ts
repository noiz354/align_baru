/**
 * Age gate and consent enforcement port.
 *
 * Requirements:
 * - FR-ENTRY-001 … FR-ENTRY-010
 * - FR-ENTRY-005 (no chat before the gate, including via direct URL)
 *
 * ADR:
 * - ADR-014 (anonymity model)
 *
 * See:
 * - docs/safety/AGE-GATING.md
 * - docs/safety/MINORS.md
 * - SAFETY.md §2, §3
 *
 * SERVICE PORT ONLY. Age gating is NOT functional in this phase.
 *
 * HONESTY REQUIREMENT (NFR-SAFE-003): the gate must not claim to verify
 * age. It is a self-attestation, and the limitations statement says so.
 */

import type { ConsentRecord } from '../../domain/participant/participant';

export interface AgeGateState {
  /** Both checkboxes are unchecked by default. */
  attestedAge: boolean;
  acknowledgedRisks: boolean;
  canContinue: boolean;
}

export const INITIAL_AGE_GATE_STATE: AgeGateState = {
  attestedAge: false,
  acknowledgedRisks: false,
  canContinue: false,
};

/**
 * The Continue action is GENUINELY disabled, not merely styled so.
 */
export function evaluateAgeGate(state: AgeGateState): AgeGateState {
  return {
    ...state,
    canContinue: state.attestedAge && state.acknowledgedRisks,
  };
}

export interface AgeGateService {
  /** Throws unless consent is current for the requested capability. */
  assertChatEligible(consent: ConsentRecord | null, serverVersion: number): void;
  /** Throws unless the IP-exposure disclosure has been acknowledged. */
  assertMediaEligible(consent: ConsentRecord | null, serverVersion: number): void;
  /** Creates the durable `age-attested` safety event. No DOB, no document. */
  recordAttestation(participantId: string, consent: ConsentRecord): Promise<void>;
}

/**
 * T-SESSION-002 — Age gate and consent enforcement.
 *
 * Throws until implemented. When implemented it must:
 * - keep both checkboxes unchecked by default
 * - genuinely disable Continue until both are checked
 * - redirect direct navigation to /queue and /chat/[sessionId]
 * - re-prompt on a consent version change (FR-ENTRY-009)
 * - be keyboard operable and screen-reader labelled (FR-ENTRY-007)
 * - record a boolean and a version, never a date of birth
 */
export const createNotImplementedAgeGateService = (): AgeGateService => ({
  assertChatEligible(
    _consent: ConsentRecord | null,
    _serverVersion: number,
  ): void {
    throw new Error('Not implemented: T-SESSION-002');
  },
  assertMediaEligible(
    _consent: ConsentRecord | null,
    _serverVersion: number,
  ): void {
    throw new Error('Not implemented: T-SESSION-002');
  },
  async recordAttestation(
    _participantId: string,
    _consent: ConsentRecord,
  ): Promise<void> {
    throw new Error('Not implemented: T-SESSION-002');
  },
});

/**
 * The five disclosure statements shown in the safety notice.
 *
 * The last is required for media modes only (ADR-014).
 */
export const SAFETY_NOTICE_STATEMENTS = [
  'You will be connected with random strangers.',
  'Conversations are not screened in real time. You may encounter offensive content.',
  'Conversations are not recorded or stored.',
  'You can leave at any time, and report or block the other person at any time.',
  'During an audio or video call, the other person may be able to determine your approximate location from your internet connection. If that matters to you, use text chat.',
] as const;
