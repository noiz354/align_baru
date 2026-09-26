/**
 * Signaling client port.
 *
 * Requirements:
 * - NFR-SEC-002 (authentication before any message)
 * - NFR-REL-001 (reconnect)
 * - NFR-SEC-004 (schema validation)
 *
 * ADR:
 * - ADR-003 (realtime transport)
 * - ADR-004 (signaling model)
 *
 * See:
 * - SIGNALING.md
 * - docs/realtime/FAILURE-MODEL.md
 * - STATE_MACHINE.md §6 (R6, R7, R12)
 *
 * CLIENT PORT ONLY. No WebSocket is opened and no frame is sent in this
 * phase.
 */

import type { SignalingMessage } from '../../shared/contracts/signaling';

/** Reconnect window. See PERFORMANCE.md §2. */
export const RECONNECT_WINDOW_MS = 15_000;

/** Maximum backoff, with jitter. See ADR-003. */
export const MAX_BACKOFF_MS = 30_000;

export interface SignalingClient {
  connect(participantId: string): Promise<void>;
  send(message: SignalingMessage): Promise<void>;
  close(): Promise<void>;
  onMessage(handler: (message: SignalingMessage) => void): void;
  onDisconnect(handler: (reason: string) => void): void;
}

/**
 * T-SIG-011 — Implement the signaling protocol.
 *
 * T-SESSION-END-015 — Reconnect and stale session rejection.
 *
 * Throws until implemented. When implemented it must:
 * - authenticate during the HTTP upgrade handshake
 * - send `fromParticipantId` equal to the authenticated identity
 * - NEVER send `toParticipantId`
 * - retry with exponential backoff and jitter, bounded by the reconnect window
 * - treat a stale session id as rejected (R7)
 * - accept `SESSION_SUPERSEDED` and return to a clean entry state (R12)
 */
export const createNotImplementedSignalingClient = (): SignalingClient => ({
  async connect(_participantId: string): Promise<void> {
    throw new Error('Not implemented: T-SIG-011');
  },
  async send(_message: SignalingMessage): Promise<void> {
    throw new Error('Not implemented: T-SIG-011');
  },
  async close(): Promise<void> {
    throw new Error('Not implemented: T-SIG-011');
  },
  onMessage(_handler: (message: SignalingMessage) => void): void {
    throw new Error('Not implemented: T-SIG-011');
  },
  onDisconnect(_handler: (reason: string) => void): void {
    throw new Error('Not implemented: T-SIG-011');
  },
});
