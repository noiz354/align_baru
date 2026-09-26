/**
 * TURN credential minting port.
 *
 * Requirements:
 * - NFR-SEC-006 (short-lived credentials)
 * - FR-ABUSE-004 (allocation quotas)
 *
 * ADR:
 * - ADR-006 (TURN strategy)
 *
 * See:
 * - WEBRTC.md §3.7
 * - SECURITY.md §8
 * - docs/security/CONTROLS.md §3
 *
 * PORT ONLY. No credential is minted, stored, or logged in this phase.
 */

export interface TurnCredentials {
  /** `<expiry>:<opaque-id>` — see ADR-006. */
  username: string;
  password: string;
  urls: string[];
  /** Minutes. Never hours. */
  ttlSeconds: number;
}

export interface MintTurnCredentialsInput {
  participantId: string;
  sessionId: string;
}

/** Credential lifetime. See ADR-006 and PERFORMANCE.md §2. */
export const TURN_CREDENTIAL_TTL_SECONDS = 300;

/** Per-identity allocation quota (FR-ABUSE-004). */
export const TURN_ALLOCATIONS_PER_IDENTITY = 1;

/**
 * The TURN credential port.
 *
 * T-TURN-091
 *
 * Throws until implemented. When implemented, it must:
 * - mint time-limited (minutes) HMAC credentials per session
 * - refuse minting for a banned or restricted identity
 * - rate limit minting to 1 per session and 5 per hour per identity
 * - NEVER store, log, or place a credential in a URL
 *
 * The static auth secret exists only in the server secret store and is
 * rotated on a schedule (OPERATIONS.md §9).
 */
export interface TurnCredentialPort {
  mintCredentials(input: MintTurnCredentialsInput): Promise<TurnCredentials>;
  assertWithinQuota(participantId: string): Promise<void>;
}

export const createNotImplementedTurnCredentialPort =
  (): TurnCredentialPort => ({
    async mintCredentials(
      _input: MintTurnCredentialsInput,
    ): Promise<TurnCredentials> {
      throw new Error('Not implemented: T-TURN-091');
    },
    async assertWithinQuota(_participantId: string): Promise<void> {
      throw new Error('Not implemented: T-TURN-091');
    },
  });

/**
 * coturn deployment configuration reference.
 *
 * This is the full hardened `turnserver.conf` documented in ADR-006. It is
 * reproduced here for the deployment task and is NOT executed.
 *
 * Version floor: 4.5.0.8 (earlier versions leak IPv6 UDP sockets).
 */
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
  // Verbose logging is disabled in production (PRIVACY.md §6).
  verbose: '',
};
