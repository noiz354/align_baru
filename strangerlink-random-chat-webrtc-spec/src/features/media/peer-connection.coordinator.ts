/**
 * WebRTC peer connection coordinator port.
 *
 * Requirements:
 * - FR-MEDIA-001 … FR-MEDIA-009
 * - NFR-REL-002 (ICE restart)
 *
 * ADR:
 * - ADR-005 (WebRTC topology)
 * - ADR-006 (TURN strategy)
 *
 * See:
 * - WEBRTC.md
 * - docs/realtime/FAILURE-MODEL.md
 *
 * COORDINATOR PORT ONLY.
 *
 * NO REAL WEBRTC NEGOTIATION EXISTS IN THIS PHASE. No RTCPeerConnection is
 * created anywhere in this repository. WebRTC is VS-8 through VS-11 and is
 * NOT implemented now.
 */

import type { ChatMode } from '../../shared/contracts/signaling';

/** Media state. Transient and terminal are distinguished (WEBRTC.md §6). */
export type MediaState =
  | 'idle'
  | 'requesting-permission'
  | 'permission-denied'
  | 'no-device'
  | 'device-busy'
  | 'active'
  | 'reconnecting'
  | 'failed';

export type MediaFailureReason =
  | 'permission-denied'
  | 'no-device'
  | 'device-busy'
  | 'ice-timeout'
  | 'turn-unavailable'
  | 'camera-disappeared'
  | 'network-switch';

export interface PeerConnectionCoordinator {
  /** Requests media. Requires an explicit user gesture (FR-MEDIA-003). */
  requestMedia(
    kind: 'camera' | 'microphone',
    gestureToken: string,
  ): Promise<MediaState>;
  /** Stops and releases all tracks. Called on session end, every exit path. */
  releaseAllTracks(): Promise<void>;
  /** At most one automatic ICE restart (NFR-REL-002). */
  restartIce(): Promise<boolean>;
}

/**
 * T-MEDIA-081 — Browser media lifecycle coordinator.
 *
 * T-MEDIA-082 — ICE restart and network-change handling.
 *
 * Throws until implemented. When implemented it must:
 * - require an explicit user gesture before any media request
 * - treat a permission denial as a RECOVERABLE state — the session continues
 *   in text (FR-MEDIA-004)
 * - surface a SPECIFIC state on every media failure — never a generic
 *   spinner and never a silent session end (FR-MEDIA-007)
 * - never call MediaRecorder, capture a stream, or upload media
 *   (FR-MEDIA-008) — enforced by lint
 * - stop all tracks on session end, in every exit path
 * - distinguish `reconnecting` (transient) from `failed` (terminal)
 * - attempt at most one automatic ICE restart
 */
export const createNotImplementedPeerConnectionCoordinator =
  (): PeerConnectionCoordinator => ({
    async requestMedia(
      _kind: 'camera' | 'microphone',
      _gestureToken: string,
    ): Promise<MediaState> {
      throw new Error('Not implemented: T-MEDIA-081');
    },
    async releaseAllTracks(): Promise<void> {
      throw new Error('Not implemented: T-MEDIA-081');
    },
    async restartIce(): Promise<boolean> {
      throw new Error('Not implemented: T-MEDIA-082');
    },
  });

/**
 * ICE server assembly reference.
 *
 * No STUN or TURN integration exists in this phase. The configuration
 * referenced here is assembled by T-MEDIA-081.
 */
export interface IceServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

/**
 * Media mode capability check.
 *
 * Media modes are gated by kill switches (ADR-016). There is deliberately
 * NO kill switch for reporting.
 */
export function isMediaMode(mode: ChatMode): boolean {
  return mode !== 'TEXT';
}
