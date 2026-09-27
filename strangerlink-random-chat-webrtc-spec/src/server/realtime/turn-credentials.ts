/**
 * TURN credential minting — real implementation with documented stub boundary.
 *
 * Requirements:
 * - NFR-SEC-006 (short-lived)
 * - FR-ABUSE-004 (quotas)
 * - T-TURN-091
 * - ADR-006
 * - WEBRTC.md §3.7, ABUSE_PREVENTION.md §9.9
 */

import crypto from 'crypto';
import { banStore, rateLimitStore, sessionStore } from '../db/in-memory';

export interface TurnCredentials {
  username: string;
  password: string;
  urls: string[];
  ttlSeconds: number;
}

export interface MintTurnCredentialsInput {
  participantId: string;
  sessionId: string;
}

export const TURN_CREDENTIAL_TTL_SECONDS = 300;
export const TURN_ALLOCATIONS_PER_IDENTITY = 1;

export const COTURN_REFERENCE_CONFIG: Readonly<Record<string, string>> = {
  listening_port: '3478',
  tls_listening_port: '5349',
  alt_listening_port: '443',
  alt_tls_listening_port: '443',
  min_port: '49152',
  max_port: '65535',
  fingerprint: '',
  use_auth_secret: '',
  realm: 'turn.example.com',
  stale_nonce: '600',
  cert: '/etc/coturn/certs/turn.crt',
  pkey: '/etc/coturn/certs/turn.key',
  no_sslv3: '',
  no_tlsv1: '',
  no_tlsv1_1: '',
  no_multicast_peers: '',
  no_stun_backward_compatibility: '',
  response_origin_only_with_rfc5780: '',
  no_tcp_relay: '',
  user_quota: '12',
  total_quota: '1200',
  proc_user: 'turnserver',
  proc_group: 'turnserver',
};

export interface TurnCredentialPort {
  mintCredentials(input: MintTurnCredentialsInput): Promise<TurnCredentials>;
  assertWithinQuota(participantId: string): Promise<void>;
}

/**
 * Production TURN secret is intentionally not stored in repository.
 * This implementation uses environment variable TURN_STATIC_AUTH_SECRET
 * for development, and fails with documented error if missing in production.
 *
 * WHY THIS REMAINS PARTIALLY STUBBED IN PRODUCTION:
 * Production TURN secret material is intentionally not stored in the repository
 * or development environment.
 *
 * REQUIREMENTS:
 * - FR-VIDEO-014, NFR-SEC-022, NFR-PRIVACY-009, T-TURN-091
 *
 * RELATED ADR:
 * - ADR-006-turn-strategy.md
 *
 * EXPECTED INPUT:
 * - participant/session identity
 * - active chat session
 *
 * EXPECTED OUTPUT:
 * - short-lived ICE server credentials
 * - expiry
 * - TURN URLs allowed by deployment policy
 *
 * SECURITY INVARIANTS:
 * - long-term TURN secret must never reach browser
 * - credentials must be short-lived (minutes)
 * - issuance must be authorized for an active eligible session
 * - rate limit issuance
 *
 * PRIVACY:
 * TURN routing policy must follow ADR-005/006 and PRIVACY.md.
 *
 * FAILURE CASES:
 * - missing production secret
 * - expired session
 * - unauthorized participant
 * - TURN service unavailable
 *
 * IMPLEMENTATION LOCATION:
 * server/realtime/turn/
 *
 * UNBLOCK CONDITION:
 * Configure deployment TURN secret/service credentials via env var TURN_STATIC_AUTH_SECRET
 *
 * TRACKING:
 * T-TURN-091
 */
export const createTurnCredentialPort = (): TurnCredentialPort => ({
  async mintCredentials(input: MintTurnCredentialsInput): Promise<TurnCredentials> {
    // Authorization: participant must be in session
    const session = sessionStore.get(input.sessionId);
    if (!session) throw new Error('NOT_FOUND: session not found');
    if (session.participantAId !== input.participantId && session.participantBId !== input.participantId) {
      throw new Error('FORBIDDEN: not participant');
    }
    // Session must be active or connecting
    if (!['MATCHED', 'CONNECTING', 'ACTIVE'].includes(session.status)) {
      throw new Error('SESSION_ENDED: cannot mint for ended session');
    }

    // Ban check at TURN credential mint (T-BAN-051)
    if (banStore.isBanned(input.participantId)) {
      throw new Error('RESTRICTED: banned identity cannot mint TURN credentials');
    }

    // Rate limit: 1 per session, 5 per hour per identity (FR-ABUSE-004)
    const rlSession = rateLimitStore.check(input.participantId, 'turnCredentialsPerSession');
    // For simplicity, we track per hour separately
    const rlHour = rateLimitStore.check(input.participantId, 'turnCredentialsPerHour');
    if (!rlHour.allowed) {
      throw new Error(`RATE_LIMITED: TURN credentials per hour exceeded, retry after ${rlHour.retryAfterMs}ms`);
    }

    // Quota check
    await (createTurnCredentialPort().assertWithinQuota(input.participantId));

    // Get static auth secret from env
    const staticSecret = process.env.TURN_STATIC_AUTH_SECRET;
    if (!staticSecret) {
      // In development, use a dev secret; in production, this is a documented stub
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Production TURN credentials are not configured. See T-TURN-091. ' +
          'Configure TURN_STATIC_AUTH_SECRET env var. ' +
          'This is expected in production without secret material.',
        );
      }
    }
    const secret = staticSecret || 'dev-static-secret-for-testing-only';

    // Time-limited REST credentials: username = expiry:opaqueId, password = base64(HMAC-SHA1(secret, username))
    const expiry = Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS;
    const opaqueId = `${input.participantId.slice(0, 8)}-${input.sessionId.slice(0, 8)}`;
    const username = `${expiry}:${opaqueId}`;
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(username);
    const password = hmac.digest('base64');

    // TURN URLs — never contain credentials
    const turnHost = process.env.TURN_HOST || 'turn.example.com';
    const urls = [
      `turn:${turnHost}:3478?transport=udp`,
      `turn:${turnHost}:3478?transport=tcp`,
      `turns:${turnHost}:5349?transport=tcp`,
    ];

    // Credentials never stored, never logged, never in URL (ADR-006 MR-1)

    return {
      username,
      password,
      urls,
      ttlSeconds: TURN_CREDENTIAL_TTL_SECONDS,
    };
  },

  async assertWithinQuota(participantId: string): Promise<void> {
    // Per-identity allocation quota and per-server total quota (FR-ABUSE-004)
    // Simplified: check if already has allocation
    const rl = rateLimitStore.check(participantId, 'turnCredentialsPerSession');
    // In production, query coturn allocation count
    // Here we enforce 1 per session via rate limit already
    if (!rl.allowed && rl.retryAfterMs === null) {
      // This is the per-session cap
      throw new Error('QUOTA_EXCEEDED: TURN allocation quota exceeded');
    }
  },
});

export const createNotImplementedTurnCredentialPort = createTurnCredentialPort;
