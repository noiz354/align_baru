/**
 * Browser media lifecycle coordinator — real implementation.
 *
 * Requirements:
 * - FR-MEDIA-001 … FR-MEDIA-009
 * - NFR-REL-002 (ICE restart)
 * - T-MEDIA-081, T-MEDIA-082
 * - ADR-005, ADR-006
 * - WEBRTC.md §3
 */

import type { ChatMode } from '../../shared/contracts/signaling';

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

export interface IceServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export function isMediaMode(mode: ChatMode): boolean {
  return mode !== 'TEXT';
}

export interface PeerConnectionCoordinator {
  requestMedia(
    kind: 'camera' | 'microphone',
    gestureToken: string,
  ): Promise<MediaState>;
  releaseAllTracks(): Promise<void>;
  restartIce(): Promise<boolean>;
  createPeerConnection(iceServers: IceServerConfig[]): RTCPeerConnection | null;
  getLocalStream(): MediaStream | null;
  getRemoteStream(): MediaStream | null;
  onIceCandidate(handler: (candidate: RTCIceCandidate) => void): void;
  onConnectionStateChange(handler: (state: RTCPeerConnectionState) => void): void;
}

/**
 * Real implementation — browser only.
 * Must be instantiated client-side after explicit user gesture (FR-MEDIA-003).
 */
export const createPeerConnectionCoordinator = (): PeerConnectionCoordinator => {
  let localStream: MediaStream | null = null;
  let remoteStream: MediaStream | null = null;
  let pc: RTCPeerConnection | null = null;
  let iceCandidateHandler: ((c: RTCIceCandidate) => void) | null = null;
  let connStateHandler: ((s: RTCPeerConnectionState) => void) | null = null;
  let iceRestartCount = 0;
  const MAX_ICE_RESTARTS = 1;

  return {
    async requestMedia(kind: 'camera' | 'microphone', gestureToken: string): Promise<MediaState> {
      // FR-MEDIA-003: requires explicit user gesture token
      if (!gestureToken) {
        throw new Error('Gesture required (FR-MEDIA-003)');
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        return 'no-device';
      }

      try {
        const constraints: MediaStreamConstraints =
          kind === 'camera' ? { video: { facingMode: 'user' }, audio: true } : { audio: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStream = stream;

        // Attach tracks to peer connection if exists
        if (pc) {
          stream.getTracks().forEach(track => {
            const sender = pc!.getSenders().find(s => s.track?.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track);
            } else {
              pc!.addTrack(track, stream);
            }
          });
        }

        return 'active';
      } catch (e) {
        const err = e as DOMException;
        if (err.name === 'NotAllowedError') return 'permission-denied';
        if (err.name === 'NotFoundError') return 'no-device';
        if (err.name === 'NotReadableError') return 'device-busy';
        return 'failed';
      }
    },

    async releaseAllTracks(): Promise<void> {
      // Stop all tracks on session end, every exit path (FR-MEDIA-008 cleanup)
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(t => t.stop());
        remoteStream = null;
      }
      if (pc) {
        try {
          pc.getSenders().forEach(s => {
            try { pc!.removeTrack(s); } catch {}
          });
          pc.close();
        } catch {}
        pc = null;
      }
      iceRestartCount = 0;
    },

    async restartIce(): Promise<boolean> {
      // At most one automatic restart (NFR-REL-002, T-MEDIA-082)
      if (iceRestartCount >= MAX_ICE_RESTARTS) return false;
      if (!pc) return false;
      iceRestartCount++;
      try {
        // Create new offer with iceRestart true
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        // The offer will be sent via signaling plane externally
        return true;
      } catch {
        return false;
      }
    },

    createPeerConnection(iceServers: IceServerConfig[]): RTCPeerConnection | null {
      if (typeof RTCPeerConnection === 'undefined') return null;
      try {
        pc = new RTCPeerConnection({
          iceServers: iceServers as RTCIceServer[],
          bundlePolicy: 'max-bundle',
        });

        pc.onicecandidate = (event) => {
          if (event.candidate && iceCandidateHandler) {
            iceCandidateHandler(event.candidate);
          }
        };

        pc.onconnectionstatechange = () => {
          if (connStateHandler) {
            connStateHandler(pc!.connectionState);
          }
          // Distinguish disconnected (transient) vs failed (terminal) — WEBRTC.md §6
          if (pc!.connectionState === 'disconnected') {
            // Will attempt ICE restart via external handler
          } else if (pc!.connectionState === 'failed') {
            // Terminal failure — surface specific reason
          }
        };

        pc.ontrack = (event) => {
          if (!remoteStream) {
            remoteStream = new MediaStream();
          }
          event.streams[0]?.getTracks().forEach(t => remoteStream!.addTrack(t));
        };

        return pc;
      } catch {
        return null;
      }
    },

    getLocalStream(): MediaStream | null {
      return localStream;
    },

    getRemoteStream(): MediaStream | null {
      return remoteStream;
    },

    onIceCandidate(handler: (candidate: RTCIceCandidate) => void): void {
      iceCandidateHandler = handler;
    },

    onConnectionStateChange(handler: (state: RTCPeerConnectionState) => void): void {
      connStateHandler = handler;
    },
  };
};

export const createNotImplementedPeerConnectionCoordinator = createPeerConnectionCoordinator;
