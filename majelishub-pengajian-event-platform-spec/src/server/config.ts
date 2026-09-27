/**
 * Runtime configuration - the only place environment variables are read.
 *
 * Where this belongs: `server/config`. Every other module receives configuration by import or
 * injection; nothing else touches `process.env` (DEPLOYMENT.md §3: "Every variable here is validated by
 * the config module at boot; a missing required value must fail the boot, never a request").
 *
 * This module starts with the variables T-ORG-001 and T-SEC-001 need. The full boot-time validation
 * (every variable in `.env.example`, storage, jobs, media, retention) is completed by T-OPS-002.
 *
 * Security rules encoded here:
 *   - `RATE_LIMIT_STORE=memory` is refused outside development: the in-memory limiter resets on deploy
 *     and is not shared between replicas (docs/research/STACK-2026.md §6, ADR-0005, SECURITY.md §13).
 *   - `BETTER_AUTH_SECRET` must be present and at least 32 bytes (SECURITY.md §9).
 *   - The Postgres role used for application traffic is validated as an identifier before it is ever
 *     interpolated into a `SET LOCAL ROLE` statement (NFR-SEC-008: no string-built SQL).
 *
 * Failure cases: missing/invalid value -> throws at import time (boot), never inside a request.
 * Task ownership: T-ORG-001, T-SEC-001; completed by T-OPS-002.
 */

const ROLE_NAME_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

export interface AppConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly appUrl: string;
  readonly databaseUrl: string;
  readonly databaseStatementTimeoutMs: number;
  /** Non-superuser role application traffic runs as, so row-level security applies (ADR-0017 layer 3). */
  readonly databaseAppRole: string;
  readonly betterAuthSecret: string;
  readonly rateLimitStore: "postgres" | "memory";
  /** Rotating HMAC salt for rate-limit keys: no raw IP or contact hash is ever stored (SECURITY.md §11). */
  readonly rateLimitSalt: string;
  readonly sessionIdleMinutesOrganizer: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Configuration error: ${name} is required (see .env.example)`);
  }
  return value;
}

function integer(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Configuration error: ${name} must be a positive integer`);
  }
  return parsed;
}

/** @throws Error at boot when a required value is missing or a forbidden one is set. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnvRaw = env["NODE_ENV"] ?? "development";
  if (nodeEnvRaw !== "development" && nodeEnvRaw !== "test" && nodeEnvRaw !== "production") {
    throw new Error("Configuration error: NODE_ENV must be development, test or production");
  }

  const rateLimitStore = env["RATE_LIMIT_STORE"] ?? "postgres";
  if (rateLimitStore !== "postgres" && rateLimitStore !== "memory") {
    throw new Error("Configuration error: RATE_LIMIT_STORE must be 'postgres' or 'memory'");
  }
  if (rateLimitStore === "memory" && nodeEnvRaw === "production") {
    throw new Error(
      "Configuration error: RATE_LIMIT_STORE=memory is forbidden in production - counters would reset on deploy and would not be shared between replicas (ADR-0005, SECURITY.md §13)",
    );
  }

  const secret = required("BETTER_AUTH_SECRET");
  if (secret.length < 32 || secret === "replace-me-with-32-bytes-of-random") {
    throw new Error("Configuration error: BETTER_AUTH_SECRET must be at least 32 bytes of random data");
  }

  const appRole = env["DATABASE_APP_ROLE"] ?? "majelishub_app";
  if (!ROLE_NAME_PATTERN.test(appRole)) {
    throw new Error("Configuration error: DATABASE_APP_ROLE must be a lower-case SQL identifier");
  }

  const rateLimitSalt = env["RATE_LIMIT_SALT"] ?? "";
  if (rateLimitSalt.length === 0 && nodeEnvRaw === "production") {
    throw new Error("Configuration error: RATE_LIMIT_SALT is required in production (rotating salt for rate-limit keys)");
  }

  return {
    nodeEnv: nodeEnvRaw,
    appUrl: env["APP_URL"] ?? "http://localhost:3000",
    databaseUrl: required("DATABASE_URL"),
    databaseStatementTimeoutMs: integer("DATABASE_STATEMENT_TIMEOUT_MS", 5000),
    databaseAppRole: appRole,
    betterAuthSecret: secret,
    rateLimitStore,
    // Non-production deployments may run without an explicit salt; the counters are then keyed by a
    // fixed development salt, which is safe only because the data is throwaway.
    rateLimitSalt: rateLimitSalt.length > 0 ? rateLimitSalt : "majelishub-development-rate-limit-salt",
    // SECURITY.md §2: 8 hours idle timeout for organizer/admin surfaces.
    sessionIdleMinutesOrganizer: integer("SESSION_IDLE_MINUTES_ORGANIZER", 480),
  };
}

let cached: AppConfig | undefined;

/** Process-wide configuration, loaded once (boot). Tests call `loadConfig(env)` directly. */
export function config(): AppConfig {
  cached ??= loadConfig();
  return cached;
}
