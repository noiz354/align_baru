/**
 * features/auth — AuthService: the authentication domain rules.
 *
 * Responsibility: registration, sign-in, sign-out, session lifecycle rules,
 * reset tokens, account deletion cascade ordering.
 *
 * Requirements: FR-AUTH-001…010, NFR-SEC-001…005.
 * Architecture: ADR-006 (DB-backed sessions + Argon2id; middleware is NOT
 * the boundary — guards re-check per request, data-flow.md §4).
 * Tasks: T-AUTH-003 (register), T-AUTH-004 (sign in), T-AUTH-005 (sign
 * out), T-AUTH-009 (reset), T-AUTH-011 (deletion).
 *
 * Implementation constraints:
 * - Depends on PORTS only (UserRepository, SessionRepository,
 *   PasswordHasher, MailPort) — never on server/* (rule D1).
 * - Uniform failure responses (THREAT T-03): unknown email vs wrong
 *   password are indistinguishable (timing too — dummy verify on unknown
 *   email). `disabled` is the single documented exception (API_CONTRACT).
 * - Identity is NEVER read from request input (THREAT T-04).
 * - `role`/`status` are never writable by non-admin callers (THREAT T-07).
 */
import type {
  AuthenticationInput,
  AuthenticationResult,
  Caller,
  User,
} from '../../shared/contracts';
import type { UserRepository } from './user.repository';
import type { SessionRepository } from './session';
import type { PasswordHasher } from './password';

export interface AuthService {
  /**
   * Register a new account (role always `reader` — T-07).
   * TODO(T-AUTH-003): validate (email, password policy), create user,
   * auto-login (create session). Duplicate email ⇒ AUTH_EMAIL_TAKEN (409).
   * Uniform timing: hash runs even on duplicate (documented).
   */
  register(input: { email: string; password: string; displayName?: string }): Promise<{ user: User; sessionToken: string }>;

  /**
   * Sign in (skeleton example function from the architecture brief).
   *
   * Edge cases (T-AUTH-004):
   * - unknown email ⇒ dummy Argon2 verify (timing uniformity) ⇒ rejected
   * - disabled account ⇒ rejected 'disabled' (403, documented)
   * - stored hash params < current ⇒ re-hash on success (upgrade path)
   * - rotation: a NEW session per login; previous sessions for the user
   *   remain (multi-device, documented) but the login-time session is
   *   rotation-safe (cookie fixation nullified, THREAT T-05)
   */
  authenticate(input: AuthenticationInput): Promise<AuthenticationResult>;

  /**
   * Sign out: revoke the given session (immediate — no grace).
   * Idempotent (repeat ⇒ still ok).
   * TODO(T-AUTH-005).
   */
  signOut(sessionToken: string): Promise<void>;

  /**
   * Password reset request: ALWAYS 204-shaped (no existence signal);
   * creates a single-use 60-min token (replaces any active token).
   * TODO(T-AUTH-009): mail via MailPort (VS-9 provider).
   */
  requestPasswordReset(email: string): Promise<void>;

  /**
   * Password reset confirm: validates token (single-use, 60 min), sets new
   * password (policy), revokes ALL user sessions (forced re-login).
   * Uniform error for unknown/expired/used tokens (THREAT T-03).
   */
  confirmPasswordReset(token: string, newPassword: string): Promise<void>;

  /**
   * Account deletion (FR-AUTH-005): explicit cascade (sessions, progress,
   * history, library, bookmarks, prefs, tokens) + audit provenance
   * (THREAT T-17: zero residual private rows — test-asserted).
   * TODO(T-AUTH-011).
   */
  deleteAccount(caller: Caller): Promise<void>;
}

/**
 * Factory (wired at the composition root with port implementations).
 * TODO(T-AUTH-001…): create the concrete service (no logic here yet).
 */
export function createAuthService(deps: {
  users: UserRepository;
  sessions: SessionRepository;
  passwords: PasswordHasher;
}): AuthService {
  throw new Error('Not implemented: T-AUTH-001 (auth service wiring)');
}
