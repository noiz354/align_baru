/**
 * Participant domain types.
 *
 * Requirements:
 * - NFR-PRIV-001 (no public profile)
 * - NFR-PRIV-002 (pseudonymous session identities)
 *
 * ADR:
 * - ADR-007 (session model)
 * - ADR-014 (anonymity model)
 *
 * See:
 * - DOMAIN.md §2.1
 * - DATA_MODEL.md §3.1, §3.2
 * - PRIVACY.md §2
 */

/**
 * A pseudonymous session identity.
 *
 * There are no accounts, no credentials, no profiles, and no personal data.
 * A Participant is created on queue entry and dies with the browser session.
 */
export interface Participant {
  /** Server-generated uuidv7. Never supplied by a client (INV-7). */
  id: string;
  status: ParticipantStatus;
  createdAt: Date;
  lastSeenAt: Date;
}

export type ParticipantStatus = 'ACTIVE' | 'RESTRICTED' | 'BANNED';

/**
 * The identity a participant presents within a session.
 *
 * `riskSignalHash` is a one-way hash of a COARSE, IP-derived signal. It is
 * NOT a device fingerprint, and it can only ever trigger rate limits and
 * cooldowns — never a standalone ban. See ADR-012 MR-2 and
 * ABUSE_PREVENTION.md §5.
 */
export interface SessionIdentity {
  id: string;
  participantId: string;
  riskSignalHash: string | null;
  createdAt: Date;
}

/**
 * The age/consent attestation.
 *
 * A boolean and a version number. NO date of birth, NO name, NO document
 * reference. See docs/safety/AGE-GATING.md §2.
 */
export interface ConsentRecord {
  /** Server-controlled. A change forces re-consent (FR-ENTRY-009). */
  consentVersion: number;
  ageAttested: boolean;
  acknowledgedEphemerality: boolean;
  acknowledgedStrangerRisk: boolean;
  acknowledgedExitRights: boolean;
  /** Media modes only: the IP-exposure disclosure (ADR-014). */
  acknowledgedIpExposure: boolean;
  attestedAt: Date;
}

/**
 * Participant creation input.
 *
 * Deliberately empty of personal data. See PRIVACY.md §16.
 */
export interface CreateParticipantInput {
  consent: ConsentRecord;
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

/**
 * INV: a participant carries no personal data.
 *
 * Enforced by the absence of fields, and verified by test.
 */
export function assertParticipantHasNoPersonalData(
  participant: Participant,
): void {
  const forbiddenKeys = [
    'name',
    'email',
    'phone',
    'dateOfBirth',
    'avatar',
    'username',
    'accountId',
    'deviceId',
    'fingerprint',
    'ipAddress',
  ];
  for (const key of forbiddenKeys) {
    if (key in (participant as unknown as Record<string, unknown>)) {
      throw new Error(`Invariant violated: participant carries ${key}`);
    }
  }
}

/**
 * INV: consent must be current.
 *
 * A stale consent version suspends chat capability. See FR-ENTRY-009.
 */
export function isConsentCurrent(
  consent: ConsentRecord,
  serverVersion: number,
): boolean {
  return (
    consent.consentVersion === serverVersion &&
    consent.ageAttested &&
    consent.acknowledgedEphemerality &&
    consent.acknowledgedStrangerRisk &&
    consent.acknowledgedExitRights
  );
}

/**
 * Media modes additionally require the IP-exposure acknowledgement.
 * See ADR-014 and DESIGN.md §5.
 */
export function isConsentSufficientForMedia(
  consent: ConsentRecord,
  serverVersion: number,
): boolean {
  return isConsentCurrent(consent, serverVersion) && consent.acknowledgedIpExposure;
}

/**
 * Participant service port.
 *
 * T-SESSION-001
 *
 * No implementation exists in this phase.
 */
export interface ParticipantService {
  createParticipant(input: CreateParticipantInput): Promise<Participant>;
  getParticipant(participantId: string): Promise<Participant | null>;
  markRestricted(participantId: string, until: Date): Promise<void>;
  markBanned(participantId: string): Promise<void>;
}
