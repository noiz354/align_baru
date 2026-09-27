/**
 * Safety event types — real implementation.
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
  payload: Record<string, string | number | boolean>;
  createdAt: Date;
}

export type ProtocolViolationClass =
  | 'impersonation'
  | 'cross-session'
  | 'forbidden-field'
  | 'oversized-payload'
  | 'bad-origin';

export interface SafetyEventPort {
  record(event: Omit<SafetyEvent, 'id' | 'createdAt'>): Promise<SafetyEvent>;
  escalateP0(event: SafetyEvent): Promise<void>;
}

export const createSafetyEventPort = (store: {
  record(type: SafetyEventType, participantId: string | null, sessionId: string | null, payload: Record<string, string | number | boolean>): SafetyEvent;
}): SafetyEventPort => ({
  async record(event: Omit<SafetyEvent, 'id' | 'createdAt'>): Promise<SafetyEvent> {
    return store.record(event.type, event.participantId, event.sessionId, event.payload);
  },
  async escalateP0(event: SafetyEvent): Promise<void> {
    // P0 bypasses normal queue, pages on-call, measured latency
    // In production: PagerDuty/Opsgenie
    // Here: record escalation
    store.record('escalation-raised', event.participantId, event.sessionId, {
      originalEventId: event.id,
      type: event.type,
    });
  },
});
