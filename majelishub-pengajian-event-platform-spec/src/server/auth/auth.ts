/**
 * Identity instance - Better Auth configured for MajelisHub (ADR-0005).
 *
 * Where this belongs: `server/auth`. This is the only place the identity library is configured; routes
 * mount its handler (`src/app/api/auth/[...all]/route.ts`) and application code reads sessions through
 * `src/server/auth/session.ts`. Better Auth answers "who is this"; it never answers "may they do this"
 * (ADR-0005 Enforcement - authorization stays ours, `docs/security/AUTHZ-MATRIX.md`).
 *
 * Configuration decisions and why:
 *   - `database: pool` - users, sessions, accounts and verifications live in OUR PostgreSQL, so they are
 *     exportable and deletable under UU PDP (ADR-0005). Table/column names are mapped explicitly to the
 *     schema in `src/server/db/schema/identity.ts` (DATA_MODEL.md §1).
 *   - `rateLimit.customStorage` - the library's in-memory limiter is forbidden in production: it resets
 *     on deploy and is not shared between replicas (STACK-2026 §6, ADR-0005, SECURITY.md §13). The
 *     durable store is `rate_limit_buckets`; `config()` refuses `RATE_LIMIT_STORE=memory` in production.
 *   - `rateLimit.enabled: true` - the library only rate-limits in production by default; we want the
 *     same behaviour in every environment so tests exercise the real path.
 *   - `session.cookieCache` disabled - authorization must never be answered from a cached cookie
 *     (SECURITY.md §3: UI hiding and client-side state are never a control).
 *   - Cookies `HttpOnly; Secure; SameSite=Lax` (SECURITY.md §2), with `SameSite=Lax` rather than `Strict`
 *     so a participant arriving from a notification link is not silently signed out.
 *   - No participant accounts. Participants hold capability tokens (ADR-0006) and never appear in
 *     `users`; `users` is documented as "never a participant" (DATA_MODEL.md §1).
 *
 * Failure cases: database unreachable -> sign-in fails with an error (never a silent local session);
 * missing/short secret -> boot failure in `config()`; a revoked or expired session -> `getSession()`
 * returns null and the caller responds 401.
 *
 * Task ownership: T-ORG-001. Passkeys/2FA for administrative roles are T-SEC-009; the organization
 * plugin / membership CRUD is T-ORG-002.
 */
import { randomUUID } from "node:crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { config, type AppConfig } from "@/server/config";
import { getDb, getPool } from "@/server/db/client";
import { createDurableAuthRateLimitStorage } from "@/server/auth/rate-limit";
import { AUTH_POLICIES } from "@/server/auth/rate-limit";

export interface AuthDependencies {
  readonly config: AppConfig;
  /** Rate-limit storage; injectable so tests can point it at their own database handle. */
  readonly rateLimitStorage: ReturnType<typeof createDurableAuthRateLimitStorage>;
  /**
   * Identity store. Injectable because the store is a port (ARCHITECTURE.md §5): production passes the
   * `pg` pool (users/sessions/accounts live in OUR PostgreSQL - ADR-0005/0006), and the integration
   * test passes a Drizzle instance over PGlite so the same code path runs against a real PostgreSQL 18
   * engine without a container (TESTING.md §1.5, docs/research/STACK-2026.md §20).
   */
  readonly database: NonNullable<BetterAuthOptions["database"]>;
}

/** Build an identity instance. Pure with respect to configuration: no global state is touched. */
export function createAuth(deps: AuthDependencies) {
  const cfg = deps.config;
  return betterAuth({
    appName: "MajelisHub",
    baseURL: cfg.appUrl,
    secret: cfg.betterAuthSecret,
    database: deps.database,

    // Map the library's camelCase model fields onto our snake_case columns (DATA_MODEL.md §1).
    user: {
      modelName: "users",
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        phoneE164: { type: "string", required: false, returned: false, input: false, fieldName: "phone_e164" },
        lastSeenAt: { type: "date", required: false, returned: false, input: false, fieldName: "last_seen_at" },
        blockedUntil: { type: "date", required: false, returned: false, input: false, fieldName: "blocked_until" },
        blockedReason: { type: "string", required: false, returned: false, input: false, fieldName: "blocked_reason" },
      },
    },
    session: {
      modelName: "sessions",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        userId: "user_id",
      },
      additionalFields: {
        deviceLabel: { type: "string", required: false, returned: true, input: true, fieldName: "device_label" },
      },
      // SECURITY.md §2: sessions live in the database; idle timeout for organizer surfaces is 8 hours.
      // All three values are SECONDS - a bare number is not days. Verified 2026-09-27 by
      // tests/integration/identity/auth-round-trip.test.ts, which reads `sessions.expires_at` back and
      // fails if the stored lifetime is not ~30 days.
      expiresIn: 60 * 60 * 24 * 30, // 30 days absolute lifetime; revocation is what actually ends a session
      updateAge: 60 * 60 * 24, // refresh the stored expiry at most once a day
      freshAge: cfg.sessionIdleMinutesOrganizer * 60, // re-authenticate for sensitive actions after 8h
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "accounts",
      fields: {
        accountId: "account_id",
        providerId: "provider_id",
        userId: "user_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    verification: {
      modelName: "verifications",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },

    emailAndPassword: {
      enabled: true,
      // A deployment without an email provider cannot verify addresses (EMAIL_PROVIDER=disabled);
      // requiring verification there would lock every organizer out. T-ORG-003 wires invitations.
      requireEmailVerification: false,
      minPasswordLength: 12,
    },

    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      // Durable, shared across replicas, atomic per attempt (ADR-0005, SECURITY.md §13).
      customStorage: deps.rateLimitStorage,
      customRules: {
        // Align the library's own paths with AUTH_POLICIES so one threshold set governs sign-in abuse.
        "/sign-in/email": { window: AUTH_POLICIES.signInLinkRequest.windowSeconds, max: AUTH_POLICIES.signInLinkRequest.limit },
        "/sign-up/email": { window: AUTH_POLICIES.signInLinkRequest.windowSeconds, max: AUTH_POLICIES.signInLinkRequest.limit },
      },
    },

    advanced: {
      // SECURITY.md §2 + .env.example TRUSTED_PROXY_HOPS: the client address comes from the proxy chain.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-client-ip"] },
      database: {
        /**
         * Identity ids are generated HERE, not by the database, and this is not a stylistic choice.
         *
         * `generateId: "uuid"` tells Better Auth "the database produces the UUID": every Postgres
         * adapter reports `supportsUUIDs: true` (both the `pg`/kysely path used in production and the
         * Drizzle adapter), and the library then omits `id` from the INSERT and lets a column default
         * fill it. Our identity id columns are `text` with no server default — the deviation recorded in
         * TASKS.md T-ORG-001 / DATA_MODEL.md, because the library issues its own identifiers while
         * domain aggregates keep UUIDv7 — so that INSERT arrives as `values (default, …)` and the
         * not-null constraint refuses it (`null value in column "id" of relation "users"`).
         *
         * Verified 2026-09-27 against PostgreSQL 18 by tests/integration/identity/auth-round-trip.test.ts.
         */
        generateId: (): string => randomUUID(),
      },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: cfg.nodeEnv === "production",
        sameSite: "lax",
      },
    },

    // No telemetry to a third party: this deployment is self-hosted and privacy-first (PRIVACY.md).
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/**
 * Process-wide identity instance. Created on first use, never at module scope: importing this module
 * must not open a database connection (that would break tests and the build).
 */
export function auth(): Auth {
  instance ??= createAuth({
    config: config(),
    database: getPool(),
    rateLimitStorage: createDurableAuthRateLimitStorage(getDb()),
  });
  return instance;
}
