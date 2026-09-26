/**
 * Safety event types.
 *
 * Requirements:
 * - FR-SAFE-008 (escalation)
 * - FR-ENTRY-004 (age attestation record)
 * - NFR-SAFE-004
 *
 * ADR:
 * - ADR-010 (moderation model)
 *
 * See:
 * - SAFETY.md §8
 * - DATA_MODEL.md §3.11
 */

export type SafetyEventType =
  | 'age-attested'
  | 'consent-accepted'
  | 'minor-detected'
  | 'escalation-raised'
  | 'session-terminated'
  | 'rate-limit-triggered'
  | 'protocol-violation'
  | 'permission-denied';

export interface SafetyEvent {
  id: string;
  type: SafetyEventType;
  participantId: string | null;
  sessionId: string | null;
  /** Minimal, typed. Never contains content. */
  payload: Record<string, string | number | boolean>;
  createdAt: Date;
}

/**
 * A protocol violation detected on the signaling plane.
 *
 * The offending payload is NEVER recorded. See THREAT_MODEL.md T-01.
 */
export type ProtocolViolationClass =
  | 'impersonation'
  | 'cross-session'
  | 'forbidden-field'
  | 'oversized-payload'
  | 'bad-origin';

/**
 * The safety event port.
 *
 * T-SAFE-052
 *
 * Throws until implemented. When implemented, P0 events must route to the
 * dedicated always-monitored queue and page the on-call, bypassing normal
 * triage entirely (FR-SAFE-008).
 */
export interface SafetyEventPort {
  record(event: Omit<SafetyEvent, 'id' | 'createdAt'>): Promise<SafetyEvent>;
  escalateP0(event: SafetyEvent): Promise<void>;
}

export const createNotImplementedSafetyEventPort = (): SafetyEventPort => ({
  async record(_event: Omit<SafetyEvent, 'id' | 'createdAt'>): Promise<SafetyEvent> {
    throw new Error('Not implemented: T-SAFE-052');
  },
  async escalateP0(_event: SafetyEvent): Promise<void> {
    throw new Error('Not implemented: T-SAFE-052');
  },
});
