/**
 * Realtime transport port.
 *
 * Requirements:
 * - NFR-SEC-002 (authentication before any message)
 * - FR-ABUSE-001 (rate limits)
 *
 * ADR:
 * - ADR-003 (realtime transport)
 *
 * See:
 * - SIGNALING.md §1, §6
 * - SECURITY.md §5
 *
 * PORT ONLY. There is NO real WebSocket server in this phase, and there is
 * no dependency on `ws` — importing one would imply a server exists.
 */

import type { SignalingMessage } from '../../shared/contracts/signaling';

/** Connection lifecycle events. */
export type ConnectionEvent =
  | { type: 'open'; participantId: string }
  | { type: 'close'; participantId: string; code: number; reason: string }
  | { type: 'error'; participantId: string; code: string }
  | { type: 'message'; participantId: string; message: SignalingMessage };

/** Application-defined close codes. See SIGNALING.md §6. */
export const CLOSE_CODES = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  POLICY_VIOLATION: 1008,
  INTERNAL: 1011,
  SUPERSEDED: 4001,
  RESTRICTED: 4002,
  PAYLOAD_TOO_LARGE: 4003,
} as const;

/**
 * Handshake requirements (ADR-003):
 * - authentication during the HTTP upgrade, BEFORE the socket opens
 * - origin allowlist checked during the handshake
 * - banned identities refused
 */
export interface HandshakeContext {
  /** The authenticated participant identity. */
  participantId: string;
  origin: string;
  /** UTC epoch milliseconds. */
  authenticatedAt: number;
}

/**
 * Transport port.
 *
 * T-SIG-011
 *
 * Throws until implemented. When implemented, it must:
 * - authenticate at the upgrade handshake, not on the first message
 * - enforce an origin allowlist
 * - cap `maxPayload` at 64 KiB
 * - apply a per-connection frame rate limit and a per-identity action limit
 * - run a heartbeat and `terminate()` zombies
 * - bind each socket to exactly one identity
 * - drain gracefully on SIGTERM, exceeding the platform grace period
 */
export interface RealtimeTransportPort {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(participantId: string, message: SignalingMessage): Promise<void>;
  close(participantId: string, code: number, reason: string): Promise<void>;
  onEvent(handler: (event: ConnectionEvent) => void): void;
}

export const createNotImplementedTransportPort =
  (): RealtimeTransportPort => ({
    async start(): Promise<void> {
      throw new Error('Not implemented: T-SIG-011');
    },
    async stop(): Promise<void> {
      throw new Error('Not implemented: T-SIG-011');
    },
    async send(_participantId: string, _message: SignalingMessage): Promise<void> {
      throw new Error('Not implemented: T-SIG-011');
    },
    async close(
      _participantId: string,
      _code: number,
      _reason: string,
    ): Promise<void> {
      throw new Error('Not implemented: T-SIG-011');
    },
    onEvent(_handler: (event: ConnectionEvent) => void): void {
      throw new Error('Not implemented: T-SIG-011');
    },
  });
