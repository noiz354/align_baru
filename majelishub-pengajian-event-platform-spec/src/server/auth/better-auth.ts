/**
 * The Better Auth instance — the one place identity is configured.
 *
 * Where this belongs: server/auth (an infrastructure adapter around a library). Better Auth answers
 * "who is this"; it never answers "may they do this" — authorization is ours (ADR-0005 §Enforcement,
 * `src/server/auth/permissions.ts`, T-SEC-002).
 *
 * Specification:
 *   ADR-0005 — Better Auth 1.6+ with sessions in our Postgres, participants need no account.
 *   SECURITY.md §2 — session cookies HttpOnly/Secure/SameSite=Lax; idle timeout 8 h for
 *     organizer/admin surfaces; revocation must take effect.
 *   SECURITY.md §13 — rate limits are durable; the library's in-memory default is forbidden.
 *   NFR-SEC-011 — the secret comes from the environment, never from the repository.
 *   DATA_MODEL.md §Global conventions — primary keys are UUIDv7.
 *
 * Invariants:
 *   1. Sessions are stored in Postgres, so a restart does not log anyone out and a revoked session
 *      stops working immediately (the cookie cache is disabled for that reason).
 *   2. Sign-up on the public surface is **off**. Anyone who can reach the app must not be able to
 *      mint an organizer identity; accounts are created by invitation (T-ORG-003) or by a platform
 *      operator through the server API.
 *   3. `createAuth` takes the database explicitly, so a test can run the same configuration against
 *      an embedded Postgres. Production uses the pooled client via `auth()`.
 *
 * Task ownership: T-ORG-001. Passkeys/2FA are T-SEC-009; organization membership is T-ORG-002.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { requiredEnv, requiredIntEnv } from "@/server/bootstrap/env";
import { createAuthRateLimitStorage } from "@/server/auth/rate-limit";
import { db, type Database, type SqlExecutor } from "@/server/db/client";
import { identitySchema } from "@/server/db/schema/identity";

/**
 * UUIDv7 (RFC 9562): a 48-bit big-endian Unix-millisecond prefix followed by randomness.
 * Time-sortable like the DATA_MODEL.md convention requires, without a dependency — the alternative,
 * the library's `"uuid"` generator, produces v4 and loses the ordering property.
 *
 * Local on purpose: this is the only consumer today. Extract it to `src/shared/` when a second
 * module needs ids.
 */
export function uuidV7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const ms = Math.floor(now);
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = (ms / 2 ** 32) & 0xff;
  bytes[2] = (ms / 2 ** 24) & 0xff;
  bytes[3] = (ms / 2 ** 16) & 0xff;
  bytes[4] = (ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** SECURITY.md §2: 8 hours of inactivity for organizer/admin surfaces, refreshed by use. */
const DEFAULT_SESSION_IDLE_SECONDS = 8 * 60 * 60;
/** Refresh the expiry when a session is used and is older than this, so active work is not cut off. */
const DEFAULT_SESSION_REFRESH_SECONDS = 30 * 60;

export function createAuth(database: Database) {
  return betterAuth({
    appName: "majelishub",
    baseURL: requiredEnv("APP_URL"),
    secret: requiredEnv("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: identitySchema,
      // Our tables are plural (`users`, `sessions`), which is what DATA_MODEL.md names them.
      usePlural: true,
    }),

    emailAndPassword: {
      enabled: true,
      // Invariant 2: no self-service organizer sign-up. See the module doc comment.
      disableSignUp: true,
      // Email delivery lands with the notification channels in VS-12; until then a platform operator
      // creates the account and the first sign-in does not depend on a provider.
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },

    session: {
      expiresIn: requiredIntEnv("AUTH_SESSION_IDLE_SECONDS", DEFAULT_SESSION_IDLE_SECONDS),
      updateAge: DEFAULT_SESSION_REFRESH_SECONDS,
      // A cached session survives revocation for the length of the cache. Revocation must be
      // immediate (SECURITY.md §10: "emergency revocation (session kill) is one action").
      cookieCache: { enabled: false },
      // The session row carries `updated_at`, which is what "last seen" is derived from.
      disableSessionRefresh: false,
    },

    rateLimit: {
      enabled: true,
      // The durable store; `storage` is ignored when `customStorage` is set (Better Auth docs).
      // Per-path rules remain the library's, including its stricter rules for the sign-in paths.
      // `Database` is a richer type than the repository's `SqlExecutor` (it also offers the query
      // builder, which no repository here uses). The cast narrows it to the surface the store needs.
      customStorage: createAuthRateLimitStorage(database as unknown as SqlExecutor),
    },

    advanced: {
      // Secure cookies also work over http://localhost, which browsers treat as a trustworthy
      // origin, so this does not have to be relaxed for local development.
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
      generateId: () => uuidV7(),
      ipAddress: {
        /**
         * IP tracking is off, so `sessions.ip_address` stays NULL.
         *
         * Why: `PRIVACY.md` §3 records IP addresses as **hashed** wherever they are stored, and the
         * library writes whatever the request presents. We do not need it: the durable limiter is
         * keyed by the authenticated subject (an email digest), which is the dimension that stops
         * credential stuffing, and the session row still carries `expires_at` and `user_agent` for
         * the "my sessions" surface.
         *
         * Consequence accepted here: Better Auth's own per-path limiter falls back to one bucket per
         * path instead of per IP. The IP dimension is not dropped — it arrives with the durable
         * limiter in T-SEC-010, hashed with a rotating salt exactly as `PRIVACY.md` describes.
         */
        disableIpTracking: true,
      },
    },

    trustedOrigins: [requiredEnv("APP_URL")],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/**
 * The process-wide instance. Constructed on first use, so importing this module does not require
 * `DATABASE_URL` — but calling it does, and a missing secret fails the boot rather than a request.
 */
export function auth(): Auth {
  if (instance) return instance;
  instance = createAuth(db());
  return instance;
}
